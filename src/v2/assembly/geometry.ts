export type Vec3 = readonly [number, number, number]
export type Axes = readonly [Vec3, Vec3, Vec3] // column vectors
export interface Pose { readonly positionM: Vec3; readonly axes: Axes }

export const identity: Axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
export const flip: Axes = [[1, 0, 0], [0, -1, 0], [0, 0, -1]]
export const plusX: Axes = [[0, 0, -1], [0, 1, 0], [1, 0, 0]]
export const minusX: Axes = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]
export const plusY: Axes = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]
export const minusY: Axes = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]

export const twists = [0, 90, 180, 270] as const
export type Twist = (typeof twists)[number]
const rotations: Record<Twist, Axes> = {
  0: identity,
  90: [[0, 1, 0], [-1, 0, 0], [0, 0, 1]],
  180: [[-1, 0, 0], [0, -1, 0], [0, 0, 1]],
  270: [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
}

export function transform(axes: Axes, [x, y, z]: Vec3): Vec3 {
  const [a, b, c] = axes
  return [
    a[0] * x + b[0] * y + c[0] * z,
    a[1] * x + b[1] * y + c[1] * z,
    a[2] * x + b[2] * y + c[2] * z,
  ]
}

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const negate = ([x, y, z]: Vec3): Vec3 => [-x, -y, -z]

function compose(parent: Pose, child: Pose): Pose {
  const [x, y, z] = child.axes
  return {
    positionM: add(parent.positionM, transform(parent.axes, child.positionM)),
    axes: [transform(parent.axes, x), transform(parent.axes, y), transform(parent.axes, z)],
  }
}

export const origin: Pose = { positionM: [0, 0, 0], axes: identity }

export function mate(parent: Pose, host: Pose, guest: Pose, twist: Twist): Pose {
  const [a, b, c] = guest.axes
  const inverse: Axes = [[a[0], b[0], c[0]], [a[1], b[1], c[1]], [a[2], b[2], c[2]]]
  const aligned = compose({ positionM: [0, 0, 0], axes: rotations[twist] }, { positionM: [0, 0, 0], axes: flip })
  return compose(compose(compose(parent, host), aligned), {
    positionM: transform(inverse, negate(guest.positionM)), axes: inverse,
  })
}
