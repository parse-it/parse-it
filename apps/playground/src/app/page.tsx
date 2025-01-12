import Image from "next/image"
import { getUserCount } from "./services/postgres"

export default async function Home() {
  const count = await getUserCount()
  return (
    <div>
      <h1>Playground</h1>
      <p>User count: {count}</p>
    </div>
  )
}
