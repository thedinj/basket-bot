"use client";

import { useAdminSession } from "@/lib/admin/useAdminSession";
import { Container, LoadingOverlay } from "@mantine/core";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";

const DataPage: React.FC = () => {
    const params = useParams();
    const type = params.type as string;
    const { accessToken } = useAdminSession();
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!accessToken || !type) return;

            try {
                const response = await fetch(`/api/admin/data/${type}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (response.ok) {
                    const result = await response.json();
                    setData(result.data);
                    setColumns(result.columns);
                }
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [accessToken, type]);

    if (isLoading) {
        return (
            <Container size="xl" py="xl">
                <LoadingOverlay visible />
            </Container>
        );
    }

    return <DataTable data={data} columns={columns} type={type} />;
};

export default DataPage;
