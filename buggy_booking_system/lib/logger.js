const fs = require('fs');
const path = require('path');
const util = require('util');

const pad = (value, size = 2) => String(value).padStart(size, '0');

const formatTimestamp = (date = new Date()) => {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = pad(date.getMilliseconds(), 3);
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetRemainder = pad(absOffset % 60);

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} ${sign}${offsetHours}:${offsetRemainder}`;
};

const getDailyLogName = (date = new Date()) => {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `system-${year}-${month}-${day}.log`;
};

const normalizeMeta = (meta) => {
    if (!meta) {
        return '';
    }

    if (meta instanceof Error) {
        return JSON.stringify({
            name: meta.name,
            message: meta.message,
            stack: meta.stack
        });
    }

    if (typeof meta === 'string') {
        return meta;
    }

    try {
        return JSON.stringify(meta);
    } catch (error) {
        return util.inspect(meta, { depth: 5, breakLength: 120 });
    }
};

const createLogger = ({ logDir, serviceName }) => {
    fs.mkdirSync(logDir, { recursive: true });

    const writeLine = (level, message, meta) => {
        const timestamp = formatTimestamp();
        const dailyFile = path.join(logDir, getDailyLogName());
        const latestFile = path.join(logDir, 'latest.log');
        const metaText = normalizeMeta(meta);
        const line = metaText
            ? `[${timestamp}] [${level}] [${serviceName}] ${message} | ${metaText}`
            : `[${timestamp}] [${level}] [${serviceName}] ${message}`;

        fs.appendFileSync(dailyFile, `${line}\n`, 'utf8');
        fs.appendFileSync(latestFile, `${line}\n`, 'utf8');

        if (level === 'ERROR') {
            console.error(line);
            return;
        }

        if (level === 'WARN') {
            console.warn(line);
            return;
        }

        console.log(line);
    };

    return {
        info: (message, meta) => writeLine('INFO', message, meta),
        warn: (message, meta) => writeLine('WARN', message, meta),
        error: (message, meta) => writeLine('ERROR', message, meta),
        debug: (message, meta) => writeLine('DEBUG', message, meta),
        getLatestLogPath: () => path.join(logDir, 'latest.log'),
        getLogDir: () => logDir
    };
};

module.exports = {
    createLogger
};
