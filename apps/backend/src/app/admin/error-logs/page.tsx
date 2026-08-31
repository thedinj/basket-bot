"use client";

import { useAdminSession } from "@/lib/admin/useAdminSession";
import { parseSqliteTimestamp } from "@/lib/utils/sqliteUtils";
import {
    Badge,
    Button,
    Container,
    Group,
    LoadingOverlay,
    Paper,
    Table,
    Text,
    TextInput,
    Title,
    Tooltip,
} from "@mantine/core";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ErrorLogRow {
    id: string;
    requestId: string;
    userId: string | null;
    route: string;
    method: string;
    statusCode: number;
    code: string;
    message: string;
    stack: string | null;
    createdAt: string;
}

const ErrorLogsPage: React.FC = () => {
    const { accessToken, tryRefreshToken } = useAdminSession();
    const [logs, setLogs] = useState<ErrorLogRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [routeFilter, setRouteFilter] = useState("");

    const loadLogs = useCallback(async () => {
        if (!accessToken) return;

        setIsLoading(true);
        try {
            const query = routeFilter ? `?route=${encodeURIComponent(routeFilter)}` : "";
            const res = await fetch(`/api/admin/error-logs${query}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (res.status === 401) {
                await tryRefreshToken();
                return;
            }

            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
            }
        } catch (error) {
            console.error("Error loading error logs:", error);
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, routeFilter, tryRefreshToken]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    return (
        <Container size="xl" py="xl">
            <LoadingOverlay visible={isLoading} />

            <Group justify="space-between" mb="xl">
                <Title order={1}>Error Logs</Title>
                <Button component={Link} href="/admin" variant="outline">
                    Back to Dashboard
                </Button>
            </Group>

            <Group mb="md">
                <TextInput
                    placeholder="Filter by route (e.g. /api/auth/login)"
                    value={routeFilter}
                    onChange={(e) => setRouteFilter(e.target.value)}
                    style={{ flex: 1 }}
                />
                <Button onClick={loadLogs}>Refresh</Button>
            </Group>

            <Paper withBorder style={{ overflowX: "auto" }}>
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Time</Table.Th>
                            <Table.Th>Route</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Code</Table.Th>
                            <Table.Th>Message</Table.Th>
                            <Table.Th>User</Table.Th>
                            <Table.Th>Request ID</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {logs.map((log) => (
                            <Table.Tr key={log.id}>
                                <Table.Td>
                                    <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                                        {parseSqliteTimestamp(log.createdAt).toLocaleString()}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm">
                                        {log.method} {log.route}
                                    </Text>
                                </Table.Td>
                                <Table.Td style={{ whiteSpace: "nowrap" }}>
                                    <Badge
                                        color={log.statusCode >= 500 ? "red" : "orange"}
                                        miw="3em"
                                        styles={{ label: { overflow: "visible" } }}
                                    >
                                        {log.statusCode}
                                    </Badge>
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm">{log.code}</Text>
                                </Table.Td>
                                <Table.Td>
                                    <Tooltip
                                        label={log.stack ?? "No stack trace"}
                                        multiline
                                        w={400}
                                    >
                                        <Text size="sm" lineClamp={1}>
                                            {log.message}
                                        </Text>
                                    </Tooltip>
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm" c="dimmed">
                                        {log.userId ?? "-"}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
                                        {log.requestId}
                                    </Text>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
                {logs.length === 0 && !isLoading && (
                    <Text ta="center" c="dimmed" py="xl">
                        No errors logged yet.
                    </Text>
                )}
            </Paper>
        </Container>
    );
};

export default ErrorLogsPage;
