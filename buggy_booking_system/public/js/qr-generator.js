document.addEventListener('DOMContentLoaded', () => {
    const baseUrlInput = document.getElementById('base-url');
    const qrColorInput = document.getElementById('qr-color');
    const bgColorInput = document.getElementById('bg-color');
    const logoInput = document.getElementById('logo');
    const generatedUrl = document.getElementById('generated-url');
    const qrPreview = document.getElementById('qr-preview');
    const downloadPngButton = document.getElementById('download-png');
    const downloadSvgButton = document.getElementById('download-svg');
    const resetButton = document.getElementById('reset-config');
    const scanQualityBadge = document.getElementById('scan-quality');
    const summaryPickup = document.getElementById('summary-pickup');
    const summaryLocation = document.getElementById('summary-location');
    const summaryVehicle = document.getElementById('summary-vehicle');
    const previewCard = document.querySelector('.preview-card');

    const defaultBaseUrl = `${window.location.origin}/booking.html`;
    const defaultVehicleType = '4_seats';
    const defaultBrandLogo = `${window.location.origin}/img/d-soft-logo.png`;
    const vehicleLabel = '4 seats';
    const renderDebounceMs = 80;
    let logoDataUrl = defaultBrandLogo;
    let renderTimer = null;
    let lastRenderedSignature = '';

    baseUrlInput.value = defaultBaseUrl;

    const qrCode = new QRCodeStyling({
        width: 320,
        height: 320,
        type: 'svg',
        data: defaultBaseUrl,
        margin: 14,
        imageOptions: {
            crossOrigin: 'anonymous',
            margin: 8,
            hideBackgroundDots: true,
            imageSize: 0.16
        },
        dotsOptions: {
            color: qrColorInput.value,
            type: 'rounded'
        },
        backgroundOptions: {
            color: bgColorInput.value
        },
        cornersSquareOptions: {
            color: qrColorInput.value,
            type: 'extra-rounded'
        },
        cornersDotOptions: {
            color: qrColorInput.value,
            type: 'dot'
        },
        qrOptions: {
            errorCorrectionLevel: 'H',
            typeNumber: 0,
            mode: 'Byte'
        }
    });

    qrCode.append(qrPreview);

    const buildFinalUrl = () => {
        const rawBaseUrl = baseUrlInput.value.trim() || defaultBaseUrl;
        let baseUrl;

        try {
            baseUrl = new URL(rawBaseUrl, window.location.origin);
        } catch (error) {
            return {
                isValid: false,
                value: rawBaseUrl
            };
        }

        baseUrl.searchParams.set('vehicle_type', defaultVehicleType);

        return {
            isValid: true,
            value: baseUrl.toString()
        };
    };

    const updatePreviewMeta = () => {
        summaryPickup.textContent = 'Guest enters';
        summaryLocation.textContent = 'Guest enters';
        summaryVehicle.textContent = vehicleLabel;
    };

    const parseHexColor = (hexColor) => {
        const normalized = hexColor.replace('#', '');
        const safeHex = normalized.length === 3
            ? normalized.split('').map((char) => `${char}${char}`).join('')
            : normalized;

        return {
            r: Number.parseInt(safeHex.slice(0, 2), 16),
            g: Number.parseInt(safeHex.slice(2, 4), 16),
            b: Number.parseInt(safeHex.slice(4, 6), 16)
        };
    };

    const getRelativeLuminance = (hexColor) => {
        const { r, g, b } = parseHexColor(hexColor);
        const convert = (channel) => {
            const value = channel / 255;
            return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        };

        return (0.2126 * convert(r)) + (0.7152 * convert(g)) + (0.0722 * convert(b));
    };

    const getContrastRatio = (foreground, background) => {
        const foregroundLuminance = getRelativeLuminance(foreground);
        const backgroundLuminance = getRelativeLuminance(background);
        const light = Math.max(foregroundLuminance, backgroundLuminance);
        const dark = Math.min(foregroundLuminance, backgroundLuminance);

        return (light + 0.05) / (dark + 0.05);
    };

    const updateScanQuality = () => {
        const qrColor = qrColorInput.value.toLowerCase();
        const bgColor = bgColorInput.value.toLowerCase();
        const contrastRatio = getContrastRatio(qrColor, bgColor);
        const isStrongContrast = contrastRatio >= 4.5;

        if (!isStrongContrast) {
            scanQualityBadge.textContent = 'Low contrast';
            scanQualityBadge.className = 'status-pill status-pill-warning';
            return;
        }

        if (logoDataUrl) {
            scanQualityBadge.textContent = 'Logo ready';
            scanQualityBadge.className = 'status-pill';
            return;
        }

        scanQualityBadge.textContent = 'Balanced';
        scanQualityBadge.className = 'status-pill';
    };

    const setRenderingState = (isRendering) => {
        if (!previewCard) {
            return;
        }

        previewCard.classList.toggle('is-rendering', isRendering);
    };

    const renderQRCode = ({ force = false } = {}) => {
        const result = buildFinalUrl();
        generatedUrl.textContent = result.value;
        updatePreviewMeta();
        updateScanQuality();

        if (!result.isValid) {
            generatedUrl.classList.add('text-rose-600');
            setRenderingState(false);
            return;
        }

        generatedUrl.classList.remove('text-rose-600');

        const renderSignature = JSON.stringify({
            data: result.value,
            image: logoDataUrl || '',
            qrColor: qrColorInput.value,
            bgColor: bgColorInput.value
        });

        if (!force && renderSignature === lastRenderedSignature) {
            setRenderingState(false);
            return;
        }

        lastRenderedSignature = renderSignature;
        qrCode.update({
            data: result.value,
            image: logoDataUrl || undefined,
            dotsOptions: {
                color: qrColorInput.value,
                type: 'rounded'
            },
            backgroundOptions: {
                color: bgColorInput.value
            },
            cornersSquareOptions: {
                color: qrColorInput.value,
                type: 'extra-rounded'
            },
            cornersDotOptions: {
                color: qrColorInput.value,
                type: 'dot'
            }
        });
    };

    const scheduleQRCodeRender = ({ immediate = false, force = false } = {}) => {
        if (renderTimer) {
            clearTimeout(renderTimer);
            renderTimer = null;
        }

        if (immediate) {
            setRenderingState(true);
            requestAnimationFrame(() => {
                renderQRCode({ force });
                setRenderingState(false);
            });
            return;
        }

        setRenderingState(true);
        renderTimer = window.setTimeout(() => {
            requestAnimationFrame(() => {
                renderQRCode({ force });
                setRenderingState(false);
                renderTimer = null;
            });
        }, renderDebounceMs);
    };

    resetButton.addEventListener('click', () => {
        baseUrlInput.value = defaultBaseUrl;
        qrColorInput.value = '#2f3541';
        bgColorInput.value = '#ffffff';
        logoInput.value = '';
        logoDataUrl = defaultBrandLogo;
        scheduleQRCodeRender({
            immediate: true,
            force: true
        });
    });

    logoInput.addEventListener('change', (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            logoDataUrl = defaultBrandLogo;
            scheduleQRCodeRender({
                immediate: true,
                force: true
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            logoDataUrl = reader.result;
            scheduleQRCodeRender({
                immediate: true,
                force: true
            });
        };
        reader.readAsDataURL(file);
    });

    [baseUrlInput].forEach((input) => {
        input.addEventListener('input', () => {
            scheduleQRCodeRender({
                immediate: true
            });
        });
    });

    [qrColorInput, bgColorInput].forEach((input) => {
        input.addEventListener('input', () => {
            updateScanQuality();
            scheduleQRCodeRender();
        });

        input.addEventListener('change', () => {
            scheduleQRCodeRender({
                immediate: true,
                force: true
            });
        });
    });

    downloadPngButton.addEventListener('click', () => {
        qrCode.download({
            extension: 'png',
            name: 'buggy-booking-qr'
        });
    });

    downloadSvgButton.addEventListener('click', () => {
        qrCode.download({
            extension: 'svg',
            name: 'buggy-booking-qr'
        });
    });

    scheduleQRCodeRender({
        immediate: true,
        force: true
    });
});
