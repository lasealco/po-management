import { prisma } from "@/lib/prisma";

export async function nextWaveNo(tenantId: string) {
  const stamp = Date.now().toString().slice(-6);
  let candidate = `WAVE-${stamp}`;
  for (let i = 0; i < 8; i += 1) {
    const exists = await prisma.wmsWave.findFirst({
      where: { tenantId, waveNo: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `WAVE-${stamp}-${i + 1}`;
  }
  return `WAVE-${stamp}-${Math.floor(Math.random() * 1000)}`;
}
