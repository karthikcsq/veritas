// TODO: Wire up real World ID verification
// See: https://docs.worldcoin.org/reference/api

export interface WorldIdProof {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  verification_level: string;
}

export interface VerifyResult {
  success: boolean;
}

export async function verifyWorldIdProof(
  proof: WorldIdProof,
  studyId: string
): Promise<VerifyResult> {
  // TODO: Replace with actual World ID cloud verification
  // const res = await fetch(`https://developer.worldcoin.org/api/v1/verify/${process.env.NEXT_PUBLIC_WLD_APP_ID}`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     ...proof,
  //     action: `study_enrollment_${studyId}`,
  //   }),
  // });
  // return res.json();

  return { success: true };
}
