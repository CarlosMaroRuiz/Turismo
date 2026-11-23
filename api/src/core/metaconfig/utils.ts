export function getEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Error de configuración: Falta la variable obligatoria "${key}" en el archivo .env`);
    }
    return value;
}

export function getEnvOptional(key: string, fallback: string): string {
    const value = process.env[key];
    return value === undefined || value === "" ? fallback : value;
}

export function getEnvInt(key: string, fallback?: number): number {
    const raw = process.env[key];

    if (raw === undefined || raw === "") {
        if (fallback === undefined) {
            throw new Error(`Error de configuración: Falta la variable obligatoria "${key}" en el archivo .env`);
        }
        return fallback;
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
        throw new Error(`Error de configuración: "${key}" debe ser numérico y se recibió "${raw}"`);
    }
    return value;
}

export function getEnvList(key: string): string[] {
    return getEnvOptional(key, "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
