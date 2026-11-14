"""Independent Cartesian RK4 reference. Run with Python 3, no dependencies."""
import json
from math import sqrt

MU = 398600.435507 * 10**9
A = 7_200_000
E = 0.05
R_PERI = A * (1 - E)
INITIAL = (R_PERI, 0, 0, 0, sqrt(MU * (2 / R_PERI - 1 / A)), 0)


def derivative(state):
    radius = sqrt(sum(x*x for x in state[:3]))
    return (*state[3:], *(-MU * x / radius**3 for x in state[:3]))


def integrate(step, duration):
    state = INITIAL
    for _ in range(round(duration / step)):
        k1 = derivative(state)
        k2 = derivative(tuple(y + step * k / 2 for y, k in zip(state, k1)))
        k3 = derivative(tuple(y + step * k / 2 for y, k in zip(state, k2)))
        k4 = derivative(tuple(y + step * k for y, k in zip(state, k3)))
        state = tuple(y + step * (a + 2*b + 2*c + d) / 6
                      for y, a, b, c, d in zip(state, k1, k2, k3, k4))
    return state


if __name__ == '__main__':
    elapsed = 4321
    reference = integrate(0.5, elapsed)
    finer = integrate(0.25, elapsed)
    print(json.dumps({
        'method': 'Cartesian RK4, 0.5 s, convergence checked at 0.25 s',
        'constantSource': 'https://ssd.jpl.nasa.gov/astro_par.html',
        'frame': 'earth-centered-j2000', 'initialEpochTdbS': 0,
        'semiMajorAxisM': A, 'eccentricity': E, 'elapsedS': elapsed,
        'initialPositionM': INITIAL[:3], 'initialVelocityMps': INITIAL[3:],
        'positionM': reference[:3], 'velocityMps': reference[3:],
        'maxPositionConvergenceM': max(abs(a-b) for a, b in zip(reference[:3], finer[:3])),
        'maxVelocityConvergenceMps': max(abs(a-b) for a, b in zip(reference[3:], finer[3:])),
    }, indent=2))
