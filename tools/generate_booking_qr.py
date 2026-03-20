#!/usr/bin/env python3
"""
Generate a QR code PNG for a booking web URL.

Usage:
  python generate_booking_qr.py "https://example.com/booking" -o booking-qr.png
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a QR code image from a booking web URL."
    )
    parser.add_argument("url", help="Booking web URL to encode into the QR code")
    parser.add_argument(
        "-o",
        "--output",
        default="booking-qr.png",
        help="Output PNG file path (default: booking-qr.png)",
    )
    parser.add_argument(
        "--box-size",
        type=int,
        default=10,
        help="QR box size in pixels (default: 10)",
    )
    parser.add_argument(
        "--border",
        type=int,
        default=4,
        help="QR border size in boxes (default: 4)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        import qrcode
    except ImportError:
        print(
            "Missing dependency: qrcode\n"
            "Install it with:\n"
            "  pip install qrcode[pil]",
            file=sys.stderr,
        )
        return 1

    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=args.box_size,
        border=args.border,
    )
    qr.add_data(args.url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output_path)

    print(f"Saved QR code to: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
