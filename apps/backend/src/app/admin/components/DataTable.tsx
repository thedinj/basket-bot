"use client";

import { Table, Text, Badge, Container, Title, Button, Paper } from "@mantine/core";
import Link from "next/link";

interface DataTableProps {
    data: any[];
    columns: string[];
    type: string;
}

const typeLabels: Record<string, string> = {
    "users": "Users",
    "stores": "Stores",
    "store-items": "Store Items",
    "shopping-list-items": "Shopping List Items",
};

const formatValue = (key: string, value: any): React.ReactNode => {
    if (value === null || value === undefined) {
        return <Text c="dimmed" size="sm">—</Text>;
    }

    // Boolean fields (check column name for is* prefix or isChecked)
    if (key.startsWith("is") || key === "isChecked") {
        const boolVal = value === 1 || value === true;
        return (
            <Badge color={boolVal ? "green" : "gray"} size="sm">
                {boolVal ? "Yes" : "No"}
            </Badge>
        );
    }

    // Dates
    if (key.includes("At") || key.includes("Date")) {
        try {
            return <Text size="sm">{new Date(value).toLocaleString()}</Text>;
        } catch {
            return <Text size="sm">{value}</Text>;
        }
    }

    // Arrays (scopes)
    if (Array.isArray(value)) {
        if (value.length === 0) return <Text c="dimmed" size="sm">None</Text>;
        return (
            <>
                {value.map((item, idx) => (
                    <Badge key={idx} size="sm" mr={4}>
                        {item}
                    </Badge>
                ))}
            </>
        );
    }

    return <Text size="sm">{String(value)}</Text>;
};

const formatColumnName = (col: string): string => {
    return col
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
};

const DataTable: React.FC<DataTableProps> = ({ data, columns, type }) => {
    if (data.length === 0) {
        return (
            <Container size="xl" py="xl">
                <Button component={Link} href="/admin" variant="subtle" mb="md">
                    ← Back to Dashboard
                </Button>
                <Title order={2} mb="md">
                    {typeLabels[type] || type}
                </Title>
                <Paper p="xl" withBorder>
                    <Text c="dimmed" ta="center">
                        No data available
                    </Text>
                </Paper>
            </Container>
        );
    }

    return (
        <Container size="xl" py="xl">
            <Button component={Link} href="/admin" variant="subtle" mb="md">
                ← Back to Dashboard
            </Button>
            <Title order={2} mb="md">
                {typeLabels[type] || type} ({data.length})
            </Title>
            <Paper withBorder>
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            {columns.map((col) => (
                                <Table.Th key={col}>{formatColumnName(col)}</Table.Th>
                            ))}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {data.map((row, idx) => (
                            <Table.Tr key={row.id || idx}>
                                {columns.map((col) => (
                                    <Table.Td key={col}>
                                        {formatValue(col, row[col])}
                                    </Table.Td>
                                ))}
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Paper>
        </Container>
    );
};

export default DataTable;
