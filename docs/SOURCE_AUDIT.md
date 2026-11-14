# MISSION CONTROL source audit

Reviewed November 14, 2026. The workspace is the `mission-control` React + TypeScript + Vite starter, confirmed in [package.json](../package.json), [vite.config.ts](../vite.config.ts), and [src/App.tsx](../src/App.tsx). The three project briefs were read. [SOURCES.md](../references/SOURCES.md) defines the reference list, [CHALLENGE.md](../references/CHALLENGE.md) describes the intended game, and [SUBMISSION_REQUIREMENTS.md](../references/SUBMISSION_REQUIREMENTS.md) records the team's submission checklist.

## Local PDFs inspected

| Source and locator | Finding and proposed use |
| --- | --- |
| NASA, **Design and Develop Science Missions**, Julie Levri, March 26, 2025, 25 pages. Slides 8, 10, 13, 15–19. [Local PDF](../references/250323-design-and-develop-science-mission.pdf) · [NASA PDF](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf) | Work backward from the science user's deliverable to measurable requirements and how to verify them. Represent the launch, space, ground, and user segments explicitly. Translate the concept of operations into a visible sequence of imaging, eclipse, and ground contact. The webinar's BioNutrients example illustrates the process. |
| NASA CubeSat Launch Initiative, **CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers**, October 2017 revision, 96 PDF pages. Printed pp. 4, 11, 14–16, 22, 29–30, 40, 56–57. [Local PDF](../references/nasa_csli_cubesat_101_508.pdf) · [NASA PDF](https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf) | CubeSats use standardized form factors. The dispenser and mission-specific interface control documents govern launch compatibility. Funding, mass, hardware selection, ground station testing, and operations contribute to feasibility. Use a fixed 3U form factor, a mass and budget check per launch offer, and distinct on-board and delivered data totals. |
| JPL, **Space Mission Concept Development Using Concept Maturity Levels**, Wessen, Borden, Ziemer and Kwok, AIAA Space 2013, 17 PDF pages. Sections II, IV–V and Figs. 1, 3–4, 6, 8a–8c. [Local PDF](../references/13-3547_A1b.pdf) · [NASA Technical Reports Server record](https://ntrs.nasa.gov/citations/20150007816) | Early feasibility, trade studies, and point design feed back into each other. Compare science return, cost, technical margins and risk across spacecraft and ground designs. Use repeatable runs, explain the limiting resource, and let players rerun a revised design. The game score is a separate educational rubric. |

## Website access

Every URL in SOURCES.md was attempted. Status reflects this review session.

| Listed website | Access and scope |
| --- | --- |
| [NASA Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf) | Opened. Same title and slide count as the local copy used above. |
| [NASA CubeSat 101 (legacy URL)](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) | Inaccessible via the web tool. Read the local copy and opened the [NASA Science copy](https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf). |
| [NASA Goddard Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/) | Opened. Its feasibility and trade-study descriptions corroborate comparing orbit, launch, ground systems, mass, power, data rate, cost, and risk together. |
| [JPL Concept Maturity Levels (Dataverse)](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299) | Inaccessible via the web tool. Read the local paper and matched the handle to the accessible [NTRS record](https://ntrs.nasa.gov/citations/20150007816). |
| [NASA Mission Viz](https://nasa.github.io/mission-viz/) | Landing page opened. Its trajectory demos and tutorials are background for visual communication. |
| [NASA Webb Build It Yourself](https://science.nasa.gov/mission/webb/game-build-it-yourself/) | Reviewed the description and play hints. Science-led instrument selection and prelaunch revision inform the briefing and builder. |
| [Canadian Space Agency Digital games and activities](https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp) | Collection page opened. Its RADARSAT game description suggests giving the imagery a named user and a concrete task. |
| [NASA General Mission Analysis Tool (GMAT)](https://software.nasa.gov/software/GSC-19468-1) | Catalog entry opened. It describes a professional mission design and navigation tool. Background only. |
| [2023 Space Apps VR challenge](https://www.spaceappschallenge.org/2023/challenges/visualize-a-space-mission-using-virtual-reality/) | Inaccessible, HTTP 502. The official page was unavailable for review. |

## Evidence behind the simulation

- Solar arrays supply power in sunlight, generation ceases in eclipse, and rechargeable storage supports operation without generation. These relationships justify separate W and Wh budgets and an eclipse power check. [NASA Small Spacecraft Technology, 3.0 Power](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/)
- Ground contacts are scheduled and finite. The mission must carry its data between contacts and return it through a ground system. The game implements that relationship as an on-board queue and rate × contact duration. [CubeSat 101, §2.10](https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=30) · [NASA Small Spacecraft Technology, 11.0 Ground Data Systems and Mission Operations](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations/)
- The 3U form factor is documented. Landsat 9 provides a real example of visible and near-infrared imaging and Earth-observation applications. Its imagery, instrument specifications and orbit are outside the simulation inputs. [CubeSat 101, §1.1](https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=12) · [NASA Landsat 9](https://science.nasa.gov/mission/landsat-9/)
- All part masses, prices, loads, usable capacities, throughput, launch limits, orbital windows, science targets, score weights and policies in [GAME_DESIGN.md](GAME_DESIGN.md) are illustrative tuning values. The orbit schedules are authored scenarios. Game reliability measures simulated power continuity. Use original interface graphics, link references in the game and submission, and describe their actual contribution with no agency branding or implication of endorsement.

## Challenge and submission verification

The [official 2026 Space Mission Design Game page](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/) returned HTTP 502. The [HackAthlone local-event brief](https://hackathlone.com/challenges/space-mission-design-game) was accessible and describes the end-to-end mission design and operations goal. It also describes examples such as progressively more complex missions and real-mission comparisons. Use the local project brief for this MVP and check the exact official challenge and Team Project tab before submission. The private submission form was outside this review.
