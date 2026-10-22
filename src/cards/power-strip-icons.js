import original from "../assets/powerstrip.svg";
import sixUsb from "../assets/powerstrip-cn-six.svg";
import six from "../assets/powerstrip-cn-six-no-usb.svg";
import four from "../assets/powerstrip-cn-four-inline.svg";
import five from "../assets/powerstrip-cn-five-inline.svg";
import fourCord from "../assets/powerstrip-cn-four-inline-cord.svg";
import fiveCord from "../assets/powerstrip-cn-five-inline-cord.svg";
import fourLeft from "../assets/powerstrip-cn-four-inline-cord-left.svg";
import fiveLeft from "../assets/powerstrip-cn-five-inline-cord-left.svg";
import fiveTilted from "../assets/powerstrip-cn-five-inline-cord-tilted.svg";
import threeTilted from "../assets/powerstrip-cn-three-inline-cord-tilted.svg";

export const powerStripIcons = {
  default: { label: "Original", svg: original },
  "cn-six-usb": { label: "6 Sockets + 4 USB", svg: sixUsb },
  "cn-six": { label: "6 Sockets", svg: six },
  "cn-four-inline": { label: "4 Sockets - Inline", svg: four },
  "cn-five-inline": { label: "5 Sockets - Inline", svg: five },
  "cn-four-cord-right": { label: "4 Sockets - Right Cord", svg: fourCord },
  "cn-five-cord-right": { label: "5 Sockets - Right Cord", svg: fiveCord },
  "cn-five-cord-right-tilted": { label: "5 Sockets - Tilted Right Cord", svg: fiveTilted },
  "cn-three-cord-right-tilted": { label: "3 Sockets - Tilted Right Cord", svg: threeTilted },
  "cn-four-cord-left": { label: "4 Sockets - Left Cord", svg: fourLeft },
  "cn-five-cord-left": { label: "5 Sockets - Left Cord", svg: fiveLeft },
};
