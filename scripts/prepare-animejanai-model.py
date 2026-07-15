#!/usr/bin/env python3
"""Add Float32 I/O adapters to the official FP16 AnimeJaNai ONNX model.

The network and its weights stay FP16. Only the public graph boundary is
converted so WebGPU GPU buffers and Windows ML TensorFloat can share the same
packaged model.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import onnx
from onnx import TensorProto, helper


def convert(source: Path, destination: Path) -> None:
    model = onnx.load(source)
    graph = model.graph
    if len(graph.input) != 1 or len(graph.output) != 1:
        raise ValueError("AnimeJaNai model must have exactly one input and one output")

    graph_input = graph.input[0]
    graph_output = graph.output[0]
    if graph_input.type.tensor_type.elem_type != TensorProto.FLOAT16:
        raise ValueError("Expected an FP16 AnimeJaNai input")
    if graph_output.type.tensor_type.elem_type != TensorProto.FLOAT16:
        raise ValueError("Expected an FP16 AnimeJaNai output")

    internal_input = graph_input.name
    internal_output = graph_output.name
    public_input = f"{internal_input}_fp32"
    public_output = f"{internal_output}_fp32"

    graph_input.name = public_input
    graph_input.type.tensor_type.elem_type = TensorProto.FLOAT
    graph_output.name = public_output
    graph_output.type.tensor_type.elem_type = TensorProto.FLOAT

    graph.node.insert(
        0,
        helper.make_node(
            "Cast",
            inputs=[public_input],
            outputs=[internal_input],
            name="AnimeJaNai_Input_Float32_To_Float16",
            to=TensorProto.FLOAT16,
        ),
    )
    graph.node.append(
        helper.make_node(
            "Cast",
            inputs=[internal_output],
            outputs=[public_output],
            name="AnimeJaNai_Output_Float16_To_Float32",
            to=TensorProto.FLOAT,
        ),
    )

    # The upstream export advertises several unused experimental domains
    # (including ai.onnx.ml opset 5). Windows ML validates every advertised
    # domain and rejects that metadata even though all graph nodes are standard
    # ONNX. Keep only domains that are actually referenced by a node.
    used_domains = {node.domain for node in graph.node}
    for index in reversed(range(len(model.opset_import))):
        if model.opset_import[index].domain not in used_domains:
            del model.opset_import[index]

    model.producer_name = "anime4k-browser AnimeJaNai I/O adapter"
    model.producer_version = "1"
    metadata = {
        item.key: item.value
        for item in model.metadata_props
    }
    metadata.update({
        "anime4k-browser.source": source.name,
        "anime4k-browser.transform": "Float32 graph I/O; FP16 network preserved",
        "anime4k-browser.upstream": "https://github.com/the-database/mpv-AnimeJaNai",
    })
    del model.metadata_props[:]
    for key, value in sorted(metadata.items()):
        item = model.metadata_props.add()
        item.key = key
        item.value = value

    onnx.checker.check_model(model)
    destination.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(model, destination)
    onnx.checker.check_model(onnx.load(destination))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Official AnimeJaNai FP16 ONNX model")
    parser.add_argument("destination", type=Path, help="Packaged Float32-I/O ONNX model")
    args = parser.parse_args()
    convert(args.source, args.destination)


if __name__ == "__main__":
    main()
