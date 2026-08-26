/**
 * PLACEHOLDER UUIDs — replace these four with your hardware's real values
 * once your firmware team hands you the GATT (the BLE spec for how a
 * peripheral organizes its data into "services" and "characteristics")
 * profile. Nothing else in the frontend needs to change when you do —
 * everything else imports these constants instead of hard-coding UUIDs.
 *
 * | Characteristic | UUID (placeholder)                   | Direction     | Purpose                          |
 * |-----------------|---------------------------------------|---------------|-----------------------------------|
 * | DEVICE_ID        | 0000a001-0000-1000-8000-00805f9b34fb  | Device → Web  | Unique hardware identifier (read) |
 * | COMMAND           | 0000a002-0000-1000-8000-00805f9b34fb  | Web → Device  | Test commands (write)             |
 * | STATUS             | 0000a003-0000-1000-8000-00805f9b34fb  | Device → Web  | Live status (notify)              |
 */
export const SERVICE_UUID = '0000a000-0000-1000-8000-00805f9b34fb';

export const CHARACTERISTIC_UUIDS = {
  DEVICE_ID: '0000a001-0000-1000-8000-00805f9b34fb',
  COMMAND: '0000a002-0000-1000-8000-00805f9b34fb',
  STATUS: '0000a003-0000-1000-8000-00805f9b34fb',
};

/** Change this to match your product's advertised name. */
export const DEVICE_NAME_PREFIX = 'ACME_DEV';

/**
 * Filtering by service UUID is what actually restricts the browser's
 * chooser to compatible hardware; namePrefix is included as a secondary
 * filter for devices that don't advertise their service UUID pre-connection.
 * Any service you read/write after connecting must appear in `filters` or
 * `optionalServices`, or the browser will refuse access to it even after a
 * successful GATT connection.
 */
export const REQUEST_DEVICE_OPTIONS: RequestDeviceOptions = { acceptAllDevices: true, optionalServices: [SERVICE_UUID], };
