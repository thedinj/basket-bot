"use client";

import { useAdminSession } from "@/lib/admin/useAdminSession";
import type { AppSetting } from "@basket-bot/core";
import {
    Button,
    Container,
    Grid,
    Group,
    LoadingOverlay,
    Paper,
    Table,
    Text,
    TextInput,
    Title,
} from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SystemStats {
    userCount: number;
    storeCount: number;
    storeItemCount: number;
    shoppingListItemCount: number;
}

const AdminDashboardPage: React.FC = () => {
    const { logout, accessToken, tryRefreshToken } = useAdminSession();
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [settings, setSettings] = useState<AppSetting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    useEffect(() => {
        const loadData = async () => {
            if (!accessToken) return;

            try {
                const headers = {
                    Authorization: `Bearer ${accessToken}`,
                };

                const [statsRes, settingsRes] = await Promise.all([
                    fetch("/api/admin/stats", { headers }),
                    fetch("/api/admin/settings", { headers }),
                ]);

                // If both fail with 401, try to refresh token once
                if (statsRes.status === 401 || settingsRes.status === 401) {
                    const refreshed = await tryRefreshToken();
                    if (refreshed) {
                        // Retry after refresh - the useEffect will be triggered again with new token
                        return;
                    } else {
                        // Refresh failed, user will be redirected to login by the layout
                        return;
                    }
                }

                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats(statsData);
                }

                if (settingsRes.ok) {
                    const settingsData = await settingsRes.json();
                    setSettings(settingsData.settings);
                }
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [accessToken, tryRefreshToken]);

    const handleEditStart = (key: string, value: string) => {
        setEditingKey(key);
        setEditValue(value);
    };

    const handleEditCancel = () => {
        setEditingKey(null);
        setEditValue("");
    };

    const handleEditSave = async (key: string) => {
        if (!accessToken) return;

        try {
            const res = await fetch(`/api/admin/settings/${key}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ value: editValue }),
            });

            if (res.ok) {
                const data = await res.json();
                setSettings((prev) => prev.map((s) => (s.key === key ? data.setting : s)));
                setEditingKey(null);
                setEditValue("");
            }
        } catch (error) {
            console.error("Error updating setting:", error);
        }
    };

    return (
        <Container size="xl" py="xl">
            <LoadingOverlay visible={isLoading} />

            <Group justify="space-between" mb="xl">
                <Title order={1}>Admin Dashboard</Title>
                <Button variant="outline" onClick={logout}>
                    Logout
                </Button>
            </Group>

            {/* Statistics */}
            <Title order={2} mb="md">
                System Statistics
            </Title>
            <Grid mb="xl">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Paper
                        p="md"
                        withBorder
                        component={Link}
                        href="/admin/data/users"
                        style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
                    >
                        <Text size="sm" c="dimmed">
                            Users
                        </Text>
                        <Text size="xl" fw={700}>
                            {stats?.userCount ?? 0}
                        </Text>
                    </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Paper
                        p="md"
                        withBorder
                        component={Link}
                        href="/admin/data/stores"
                        style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
                    >
                        <Text size="sm" c="dimmed">
                            Stores
                        </Text>
                        <Text size="xl" fw={700}>
                            {stats?.storeCount ?? 0}
                        </Text>
                    </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Paper
                        p="md"
                        withBorder
                        component={Link}
                        href="/admin/data/store-items"
                        style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
                    >
                        <Text size="sm" c="dimmed">
                            Store Items
                        </Text>
                        <Text size="xl" fw={700}>
                            {stats?.storeItemCount ?? 0}
                        </Text>
                    </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Paper
                        p="md"
                        withBorder
                        component={Link}
                        href="/admin/data/shopping-list-items"
                        style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
                    >
                        <Text size="sm" c="dimmed">
                            Shopping List Items
                        </Text>
                        <Text size="xl" fw={700}>
                            {stats?.shoppingListItemCount ?? 0}
                        </Text>
                    </Paper>
                </Grid.Col>
            </Grid>

            {/* Settings */}
            <Title order={2} mb="md">
                Application Settings
            </Title>
            <Paper withBorder>
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Key</Table.Th>
                            <Table.Th>Value</Table.Th>
                            <Table.Th>Last Updated</Table.Th>
                            <Table.Th>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {settings.map((setting) => (
                            <Table.Tr key={setting.key}>
                                <Table.Td>
                                    <Text fw={500}>{setting.key}</Text>
                                </Table.Td>
                                <Table.Td>
                                    {editingKey === setting.key ? (
                                        <TextInput
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                        />
                                    ) : (
                                        <Text>{setting.value}</Text>
                                    )}
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm" c="dimmed">
                                        {new Date(setting.updatedAt).toLocaleString()}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    {editingKey === setting.key ? (
                                        <Group gap="xs">
                                            <Button
                                                size="xs"
                                                onClick={() => handleEditSave(setting.key)}
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant="outline"
                                                onClick={handleEditCancel}
                                            >
                                                Cancel
                                            </Button>
                                        </Group>
                                    ) : (
                                        <Button
                                            size="xs"
                                            variant="light"
                                            onClick={() =>
                                                handleEditStart(setting.key, setting.value)
                                            }
                                        >
                                            Edit
                                        </Button>
                                    )}
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Paper>
        </Container>
    );
};

export default AdminDashboardPage;
