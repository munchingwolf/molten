import { AppLoader } from "./app-loader"

export default async function LaunchedApp({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AppLoader id={id} />
}
