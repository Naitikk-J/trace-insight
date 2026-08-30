import type { Request, Response } from "express";
import { aiSystemsStatus, copilotForAddress, predictRoutesForAddress } from "../services/ai.service";
import { summariseAttribution } from "../services/attribution.service";

export function status(_req: Request, res: Response): void {
  res.json({ ok: true, systems: aiSystemsStatus() });
}

export async function predictRoute(req: Request, res: Response): Promise<void> {
  const { chain, address, maxHops, seedValueUsd } = req.body as {
    chain: Parameters<typeof predictRoutesForAddress>[0];
    address: string;
    maxHops?: number;
    seedValueUsd?: number;
  };
  const { attribution, prediction } = await predictRoutesForAddress(chain, address, {
    ...(maxHops !== undefined ? { maxHops } : {}),
    ...(seedValueUsd !== undefined ? { seedValueUsd } : {}),
  });
  res.json({ ok: true, attribution: summariseAttribution(attribution), prediction });
}

export async function copilot(req: Request, res: Response): Promise<void> {
  const { chain, address, question, maxHops, seedValueUsd } = req.body as {
    chain: Parameters<typeof copilotForAddress>[0];
    address: string;
    question: string;
    maxHops?: number;
    seedValueUsd?: number;
  };
  const { attribution, copilot: answer } = await copilotForAddress(chain, address, question, {
    ...(maxHops !== undefined ? { maxHops } : {}),
    ...(seedValueUsd !== undefined ? { seedValueUsd } : {}),
  });
  res.json({ ok: true, attribution: summariseAttribution(attribution), copilot: answer });
}
