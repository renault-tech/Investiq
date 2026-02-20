from fastapi import HTTPException


class InvestIQException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message},
        )


class NotFoundError(InvestIQException):
    def __init__(self, resource: str):
        super().__init__(404, f"{resource}.not_found", f"{resource} not found")


class UnauthorizedError(InvestIQException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(401, "auth.unauthorized", message)


class ForbiddenError(InvestIQException):
    def __init__(self):
        super().__init__(403, "auth.forbidden", "Access denied")


class ConflictError(InvestIQException):
    def __init__(self, message: str):
        super().__init__(409, "conflict.error", message)


class ValidationError(InvestIQException):
    def __init__(self, message: str):
        super().__init__(422, "validation.error", message)