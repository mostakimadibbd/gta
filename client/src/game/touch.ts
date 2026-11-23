// Harborfall — Phase 8: shared TOUCH analog state. TouchControls (the
// floating joystick) writes these; Player (on foot) and Vehicle (driving)
// read them, merged with keyboard + gamepad by last-input-wins rules:
//   · on foot — Player uses touchMove only when no keyboard/pad input
//   · driving — Vehicle uses touchSteer only when keys and the gamepad
//     stick are idle, and gyro only when the stick is centred (the
//     Asphalt rule the user asked for: stick wins when deflected)
/** Analog move vector from the touch joystick (expo-curved, 0..1 mag). */
export const touchMove = { x: 0, y: 0, mag: 0 };
/** Analog steering from the touch joystick while driving (−1..1). */
export let touchSteer = 0;
export function setTouchSteer(v: number) { touchSteer = v; }
/** Digital pedal/button state held by the touch buttons. */
export const touchButtons = { gas: false, brake: false, drift: false };
