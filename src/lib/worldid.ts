import { verifyCloudProof, IVerifyResponse, ISuccessResult } from "@worldcoin/idkit";

export async function verifyWorldIdProof(
  proof: ISuccessResult,
  studyId: string
): Promise<IVerifyResponse> {
  const result = await verifyCloudProof(
    proof,
    process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}`,
    `study_enrollment_${studyId}`
  );
  return result;
}
