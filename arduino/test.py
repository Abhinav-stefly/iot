
# gateway.py
import serial
import time
import requests
import sys
import argparse
from serial.tools import list_ports
from serial.serialutil import SerialException

# ===== CONFIG =====
SERVER_URL = "http://localhost:5000/upload"  # change to your web app endpoint
BAUDRATE = 9600
READ_TIMEOUT = 2  # seconds
# ==================

def find_arduino_port():
    ports = list_ports.comports()
    # prefer obvious Arduino/USB descriptors but be permissive
    keywords = ["arduino", "usb serial", "ttyacm", "ttyusb", "ch340", "usb", "com"]
    for p in ports:
        name = (p.device or "")
        desc = ((p.description or "") + " " + (getattr(p, "manufacturer", "") or "")).lower()
        lname = name.lower()
        if any(k in desc or k in lname for k in keywords):
            return name
    # fallback to first port if nothing matched
    if ports:
        return ports[0].device
    return None


def list_available_ports():
    ports = list_ports.comports()
    if not ports:
        print("No serial ports detected.")
        return []
    out = []
    print("Available serial ports:")
    for p in ports:
        print(f" - {p.device}: {p.description}")
        out.append(p.device)
    return out

def main():
    parser = argparse.ArgumentParser(description="Arduino gateway: read serial and forward to HTTP endpoint")
    parser.add_argument("--port", "-p", help="Serial port to use (e.g. COM3)")
    args = parser.parse_args()

    port = args.port or find_arduino_port()
    if port is None:
        print("No serial port auto-detected.")
        ports = list_available_ports()
        if not ports:
            print("Connect your Arduino (or a USB serial device) and try again.")
            sys.exit(1)
        # prompt user to pick a port
        choice = input("Enter port to use (or press Enter to cancel): ").strip()
        if not choice:
            print("No port selected. Exiting.")
            sys.exit(1)
        port = choice

    print("Using serial port:", port)

    try:
        ser = serial.Serial(port, BAUDRATE, timeout=READ_TIMEOUT)
    except SerialException as e:
        print(f"Failed to open serial port {port!r}: {e}")
        print("Common causes: another program (Arduino IDE/Serial Monitor) is using the port, or insufficient permissions.")
        print("Close other programs that might be using the serial port, or run the script with elevated privileges.")
        sys.exit(1)

    time.sleep(2)  # wait for Arduino reset

    print("Gateway started. Reading serial and sending to:", SERVER_URL)
    while True:
        try:
            line = ser.readline().decode(errors="ignore").strip()
            if not line:
                continue
            if line == "ERR":
                print("Sensor error (ERR)")
                continue
            # Expect CSV: temp,hum
            parts = line.split(",")
            if len(parts) < 2:
                print("Unexpected line:", line)
                continue
            temp = parts[0].strip()
            hum = parts[1].strip()

            # Example: GET with query params
            params = {"temp": temp, "hum": hum}
            try:
                r = requests.get(SERVER_URL, params=params, timeout=5)
                print("Sent:", params, "=>", r.status_code)
            except Exception as e:
                print("HTTP error:", e)

        except KeyboardInterrupt:
            print("Exiting.")
            break
        except Exception as e:
            print("Error reading serial:", e)
            time.sleep(1)

if __name__ == "__main__":
    main()
