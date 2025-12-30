import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface ClockEntry {
    contractor: string;
    action: "in" | "out";
    timestamp: string;
}

export default async (req: Request, context: Context) => {
    const url = new URL(req.url);
    const contractor = url.searchParams.get("contractor");

    console.log("Logs function called, contractor:", contractor || "all");

    try {
        const store = getStore({ name: "clock-logs", consistency: "strong" });
        console.log("Store initialized");

        if (contractor) {
            // Get logs for specific contractor
            const logs = await store.get(contractor, { type: "json" }) as ClockEntry[] | null;
            console.log(`Logs for ${contractor}:`, logs?.length || 0, "entries");
            return new Response(JSON.stringify({
                contractor,
                logs: logs || []
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        } else {
            // Get all contractors and their logs
            const { blobs } = await store.list();
            console.log("Found blobs:", blobs.length);
            const allLogs: { contractor: string; logs: ClockEntry[] }[] = [];

            for (const blob of blobs) {
                console.log("Reading blob:", blob.key);
                const logs = await store.get(blob.key, { type: "json" }) as ClockEntry[];
                allLogs.push({
                    contractor: blob.key,
                    logs: logs || []
                });
            }

            // Sort by contractor name
            allLogs.sort((a, b) => a.contractor.localeCompare(b.contractor));

            console.log("Returning", allLogs.length, "contractors");
            return new Response(JSON.stringify({
                contractors: allLogs.map(c => c.contractor),
                data: allLogs
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }
    } catch (error) {
        console.error("Get logs error:", error);
        return new Response(JSON.stringify({ error: "Internal server error", details: String(error) }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};

export const config: Config = {
    path: "/api/logs"
};
