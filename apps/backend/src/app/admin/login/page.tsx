"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Button,
    Container,
    Paper,
    PasswordInput,
    Stack,
    TextInput,
    Title,
    Text,
} from "@mantine/core";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const AdminLoginPage: React.FC = () => {
    const router = useRouter();
    const { login } = useAdminSession();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await login(email, password);
            router.push("/admin");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container size={420} my={40}>
            <Title ta="center" fw={900}>
                Admin Portal
            </Title>
            <Text c="dimmed" size="sm" ta="center" mt={5}>
                Sign in with your admin account
            </Text>

            <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                <form onSubmit={handleSubmit}>
                    <Stack>
                        <TextInput
                            label="Email"
                            placeholder="admin@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                        />
                        <PasswordInput
                            label="Password"
                            placeholder="Your password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                        />
                        {error && (
                            <Text c="red" size="sm">
                                {error}
                            </Text>
                        )}
                        <Button type="submit" fullWidth loading={isLoading}>
                            Sign in
                        </Button>
                    </Stack>
                </form>
            </Paper>
        </Container>
    );
};

export default AdminLoginPage;
