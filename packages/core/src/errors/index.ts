export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = "AppError";
    }
}

export class AuthenticationError extends AppError {
    constructor(message = "Authentication failed") {
        super("AUTHENTICATION_FAILED", message);
        this.name = "AuthenticationError";
    }
}

export class AuthorizationError extends AppError {
    constructor(message = "Insufficient permissions") {
        super("AUTHORIZATION_FAILED", message);
        this.name = "AuthorizationError";
    }
}

export class ValidationError extends AppError {
    constructor(message = "Validation failed", details?: unknown) {
        super("VALIDATION_FAILED", message, details);
        this.name = "ValidationError";
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource not found") {
        super("NOT_FOUND", message);
        this.name = "NotFoundError";
    }
}

export class ConflictError extends AppError {
    constructor(message = "Resource conflict") {
        super("CONFLICT", message);
        this.name = "ConflictError";
    }
}
