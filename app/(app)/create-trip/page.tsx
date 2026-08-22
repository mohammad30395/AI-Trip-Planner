import { auth } from "@clerk/nextjs/server"

import { CreateTripShell } from "@/components/create-trip/create-trip-shell"

async function CreateTripPage() {
  await auth.protect()

  return <CreateTripShell />
}

export default CreateTripPage
