"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

type Node = { id: string; label: string; kind: string };
type Edge = { from: string; to: string; critical?: boolean };

type SimNode = Node & d3.SimulationNodeDatum;
type SimLink = { source: string | SimNode; target: string | SimNode; critical?: boolean };

export function DependencyGraph({
  nodes,
  edges,
}: {
  nodes: Node[];
  edges: Edge[];
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !nodes.length) return;

    const width = ref.current.clientWidth || 480;
    const height = 280;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = edges.map((e) => ({
      source: e.from,
      target: e.to,
      critical: e.critical,
    }));

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(90),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append("g")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", (d) => (d.critical ? "#f43f5e" : "#334155"))
      .attr("stroke-width", (d) => (d.critical ? 2 : 1));

    const node = svg.append("g").selectAll("g").data(simNodes).join("g");

    node
      .append("circle")
      .attr("r", 10)
      .attr("fill", (d) =>
        d.kind === "external" ? "#8b5cf6" : d.kind === "database" ? "#f59e0b" : "#22d3ee",
      );

    node
      .append("text")
      .text((d) => d.label)
      .attr("x", 14)
      .attr("y", 4)
      .attr("fill", "#e4e4e7")
      .attr("font-size", 10);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);

  if (!nodes.length) {
    return <p className="text-sm text-zinc-500">No dependency nodes discovered.</p>;
  }

  return (
    <svg ref={ref} className="h-[280px] w-full rounded-lg bg-black/40" viewBox="0 0 480 280" />
  );
}
