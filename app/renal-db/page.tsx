import { getRenalGuidelines } from "@/actions/renalDb";
import RenalDbClient from "./RenalDbClient";

export default async function RenalDbPage() {
  const guidelines = await getRenalGuidelines();
  return <RenalDbClient initialData={guidelines} />;
}
