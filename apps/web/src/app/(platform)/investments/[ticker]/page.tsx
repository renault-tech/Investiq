import { AssetClient } from "@/components/asset/AssetClient";

interface AssetPageProps {
  params: Promise<{ ticker: string }>;
}

export default async function AssetPage({ params }: AssetPageProps) {
  const { ticker } = await params;
  return <AssetClient ticker={decodeURIComponent(ticker).toUpperCase()} />;
}
