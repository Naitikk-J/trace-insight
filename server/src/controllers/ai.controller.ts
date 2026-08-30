import { aiSystemsStatus, copilotForAddress, predictRoutesForAddress } from "../services/ai.service";
import { summariseAttribution } from "../services/attribution.service";
import { sendSuccess } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const status = asyncHandler(async (_req, res) => {
  sendSuccess(res, "AI systems", { systems: aiSystemsStatus() });
});

export const predictRoute = asyncHandler(async (req, res) => {
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
  sendSuccess(res, "Route prediction", {
    attribution: summariseAttribution(attribution),
    prediction,
  });
});

export const copilot = asyncHandler(async (req, res) => {
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
  sendSuccess(res, "Copilot answer", {
    attribution: summariseAttribution(attribution),
    copilot: answer,
  });
});
