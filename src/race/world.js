// Shared boundaries: visual shore and collision surface must agree.
export const riverWidth=d=>32+4*Math.sin(d*.004)+2*Math.sin(d*.009);
export const laneLimit=d=>riverWidth(d)-3.2;
export function rockHeight(d,side){return 9+7*Math.sin(d*.009+side)**2+13*Math.sin(d*.004+side*3)**4;}
