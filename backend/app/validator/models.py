from enum import Enum
from pydantic import BaseModel
from typing import Optional

class Severity(str, Enum):
    error = "error"    # Hard error — must fix
    warning = "warning"  # Soft warning — can proceed
    info = "info"

class ValidationError(BaseModel):
    code: str
    severity: Severity
    message: str
    object_id: Optional[str] = None  # ID of offending object
    floor_index: Optional[int] = None
    suggested_fix: Optional[str] = None

class ValidationResult(BaseModel):
    is_valid: bool  # True if no errors (warnings ok)
    errors: list[ValidationError] = []
    warnings: list[ValidationError] = []
    infos: list[ValidationError] = []
    
    @classmethod
    def from_all(cls, issues: list[ValidationError]) -> 'ValidationResult':
        errors = [i for i in issues if i.severity == Severity.error]
        warnings = [i for i in issues if i.severity == Severity.warning]
        infos = [i for i in issues if i.severity == Severity.info]
        return cls(is_valid=len(errors)==0, errors=errors, warnings=warnings, infos=infos)
