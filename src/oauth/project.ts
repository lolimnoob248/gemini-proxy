import {
  CODE_ASSIST_ENDPOINT,
  CODE_ASSIST_HEADERS,
  FREE_TIER_ID,
  LEGACY_TIER_ID,
  ONBOARD_POLL_ATTEMPTS,
  ONBOARD_POLL_DELAY_MS,
} from "../constants";
import type { LoadCodeAssistPayload, OnboardUserPayload, ProjectResolveResult } from "../types";
import { buildUserAgent } from "./userAgent";

export async function resolveProject(accessToken: string): Promise<ProjectResolveResult> {
  const loadResult = await loadCodeAssist(accessToken);
  if (!loadResult) {
    return { ok: false, error: "Failed to load Cloud Code Assist project" };
  }

  const existingProject = normalizeProjectId(loadResult.cloudaicompanionProject);
  if (existingProject) {
    return { ok: true, projectId: existingProject };
  }

  const currentTierId = loadResult.currentTier?.id;
  if (currentTierId) {
    return { ok: false, error: "Project onboarded but no managed project ID returned. Set a GCP project." };
  }

  const tier = pickTier(loadResult.allowedTiers);
  if (!tier) {
    const ineligible = loadResult.ineligibleTiers?.[0];
    const reason = ineligible?.reasonMessage ?? "Account not eligible for Gemini free tier";
    return { ok: false, error: reason };
  }

  const tierId = tier.id ?? LEGACY_TIER_ID;
  const onboardedId = await onboardUser(accessToken, tierId);
  if (!onboardedId) {
    return { ok: false, error: "Onboarding failed — could not provision a managed project" };
  }

  return { ok: true, projectId: onboardedId };
}

async function loadCodeAssist(accessToken: string): Promise<LoadCodeAssistPayload | null> {
  const url = `${CODE_ASSIST_ENDPOINT}:loadCodeAssist`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": buildUserAgent(),
        ...CODE_ASSIST_HEADERS,
      },
      body: JSON.stringify({
        metadata: {
          ideType: "IDE_UNSPECIFIED",
          platform: "PLATFORM_UNSPECIFIED",
          pluginType: "GEMINI",
        },
      }),
    });
    if (!response.ok) return null;
    return (await response.json()) as LoadCodeAssistPayload;
  } catch {
    return null;
  }
}

async function onboardUser(accessToken: string, tierId: string): Promise<string | undefined> {
  const url = `${CODE_ASSIST_ENDPOINT}:onboardUser`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": buildUserAgent(),
        ...CODE_ASSIST_HEADERS,
      },
      body: JSON.stringify({
        tierId,
        metadata: {
          ideType: "IDE_UNSPECIFIED",
          platform: "PLATFORM_UNSPECIFIED",
          pluginType: "GEMINI",
        },
      }),
    });
    if (!response.ok) return undefined;

    let payload = (await response.json()) as OnboardUserPayload;

    for (let attempt = 0; attempt < ONBOARD_POLL_ATTEMPTS; attempt += 1) {
      if (payload.done) break;
      if (!payload.name) break;
      await wait(ONBOARD_POLL_DELAY_MS);
      const opUrl = `${CODE_ASSIST_ENDPOINT}/${payload.name}`;
      const opResponse = await fetch(opUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": buildUserAgent(),
          ...CODE_ASSIST_HEADERS,
        },
      });
      if (!opResponse.ok) return undefined;
      payload = (await opResponse.json()) as OnboardUserPayload;
    }

    if (!payload.done) return undefined;
    return payload.response?.cloudaicompanionProject?.id;
  } catch {
    return undefined;
  }
}

function normalizeProjectId(value: LoadCodeAssistPayload["cloudaicompanionProject"]): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value || undefined;
  return value.id || undefined;
}

function pickTier(
  tiers: LoadCodeAssistPayload["allowedTiers"],
): { id?: string } | undefined {
  if (!tiers || tiers.length === 0) return undefined;
  const free = tiers.find((t) => t.id === FREE_TIER_ID);
  if (free) return free;
  const def = tiers.find((t) => t.isDefault);
  return def ?? tiers[0];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
