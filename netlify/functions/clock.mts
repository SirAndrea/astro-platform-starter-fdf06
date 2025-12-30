import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface ClockEntry {
    contractor: string;
    action: "in" | "out";
    timestamp: string;
}

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const body = await req.json();
        const { contractor, action } = body;

        console.log("Clock action received:", { contractor, action });

        if (!contractor || !action) {
            return new Response(JSON.stringify({ error: "Missing contractor or action" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (!["in", "out"].includes(action)) {
            return new Response(JSON.stringify({ error: "Invalid action" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Format timestamp in Pacific Time (America/Los_Angeles)
        const now = new Date();
        const pacificTime = now.toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        // Store as ISO-like format for consistency: YYYY-MM-DDTHH:mm:ss (Pacific Time)
        const [datePart, timePart] = pacificTime.split(', ');
        const [month, day, year] = datePart.split('/');
        const timestamp = `${year}-${month}-${day}T${timePart} PST`;
        const store = getStore({ name: "clock-logs", consistency: "strong" });

        console.log("Store initialized, fetching existing logs for:", contractor);

        // Get existing logs for this contractor
        const existingData = await store.get(contractor, { type: "json" }) as ClockEntry[] | null;
        const logs: ClockEntry[] = existingData || [];

        console.log("Existing logs count:", logs.length);

        // Add new entry
        const entry: ClockEntry = {
            contractor,
            action,
            timestamp
        };
        logs.push(entry);

        // Save updated logs
        await store.setJSON(contractor, logs);

        console.log("Saved! New total logs:", logs.length);

        return new Response(JSON.stringify({
            success: true,
            contractor,
            action,
            timestamp
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Clock error:", error);
        return new Response(JSON.stringify({ error: "Internal server error", details: String(error) }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};

export const config: Config = {
    path: "/api/clock"
};
