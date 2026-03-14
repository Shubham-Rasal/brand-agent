export async function GET() {
  return Response.json({
    status: 'ok',
    agent: process.env.AGENT_NAME ?? 'OpenBrand Agent',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
  });
}
