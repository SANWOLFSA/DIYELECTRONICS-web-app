// Textbook framing for every chapter of the Theory book: an introduction, a highlighted
// "What is …?" question with its answer, what you will learn, and a chapter summary.
// The chapter's topics (src/data/theory/topics) follow as the sub-topics, then the chapter exam.
// One chapter ("Cells & batteries") is fully authored here as a worked example of the format,
// with its own sections, diagrams and exam.
import type { TheorySubjectId } from './types';

export type DiagramKey =
  | 'cell-symbols' | 'cell-inside' | 'cells-series-parallel' | 'simple-circuit'
  | 'series-resistors' | 'parallel-resistors' | 'sine-wave' | 'transformer' | 'diode';

export interface ChapterIntro {
  subject: TheorySubjectId;
  intro: string[];
  question: string;
  answer: string;
  outcomes: string[];
  summary: string[];
  diagram?: DiagramKey;
}

export const CHAPTER_INTROS: ChapterIntro[] = [
  {
    subject: 'fundamentals',
    intro: [
      'Every electrical and electronic system, from a torch to a power station, is built on a handful of ideas: charge, current, voltage, resistance, power and energy. Learn these well and every later chapter becomes easier.',
      'This chapter also covers the units you will use everywhere (SI units and prefixes), how electricity is paid for, how materials behave, and the basic safety rules that keep you alive at the bench.',
    ],
    question: 'What is electricity?',
    answer: 'Electricity is the movement and effect of electric charge. When charge flows around a closed circuit we call it an electric current; the push that makes it flow is the voltage (potential difference), and the opposition to the flow is the resistance.',
    outcomes: ['Use SI units and prefixes (mA, kΩ, MW) correctly', 'Explain charge, current, voltage and resistance', 'Apply Ohm’s law and the power formulas', 'Calculate energy use and electricity cost in kWh'],
    summary: [
      'Current is the rate of flow of charge: I = Q/t, measured in amperes (A).',
      'Voltage is energy per unit charge: V = W/Q, measured in volts (V).',
      'Ohm’s law: V = I × R. Resistance depends on material, length, area and temperature (R = ρL/A).',
      'Power is the rate of using energy: P = VI = I²R = V²/R; energy W = P × t (kWh on your bill).',
      'Treat every circuit as live until you have proved it dead; mains (230 V) can kill.',
    ],
    diagram: 'simple-circuit',
  },
  {
    subject: 'dc',
    intro: [
      'Direct-current (DC) circuits are where circuit analysis starts. A battery, a few resistors and a lamp already show every rule you need: how current divides, how voltage drops, and how to predict both before you switch on.',
      'From simple series and parallel circuits we build up to Kirchhoff’s laws and the network theorems (Thévenin, Norton, superposition) that engineers use to simplify complicated circuits.',
    ],
    question: 'What is a DC circuit?',
    answer: 'A DC circuit is a closed path in which the current flows in one direction only, driven by a steady source such as a cell, battery or DC power supply. Its voltages and currents do not change with time once the circuit has settled.',
    outcomes: ['Solve series, parallel and series-parallel circuits', 'Use voltage and current dividers', 'Apply Kirchhoff’s current and voltage laws, nodal and mesh analysis', 'Simplify networks with Thévenin, Norton and superposition'],
    summary: [
      'Series: one current, resistances add, voltages divide in proportion to resistance.',
      'Parallel: one voltage, currents add, total resistance is smaller than the smallest branch.',
      'KCL: currents into a node = currents out. KVL: voltages around a loop sum to zero.',
      'Thévenin: any linear two-terminal network = one voltage source in series with one resistance.',
      'Maximum power is delivered when the load resistance equals the source (Thévenin) resistance.',
    ],
    diagram: 'series-resistors',
  },
  {
    subject: 'fields',
    intro: [
      'Charges and currents create invisible fields around them. Electric fields store energy in capacitors; magnetic fields store energy in inductors and make motors, relays, speakers and transformers work.',
      'This chapter explains those fields, the components built on them and the laws of induction that tie electricity and magnetism together.',
    ],
    question: 'What is an electric or magnetic field?',
    answer: 'A field is the region around a charge or a current where it can exert a force. An electric field (V/m) surrounds any charge and acts on other charges; a magnetic field (tesla) surrounds moving charges such as a current in a wire and acts on magnets and other currents.',
    outcomes: ['Describe capacitors, dielectrics and RC charging', 'Explain magnetism, electromagnets and magnetic circuits', 'Apply Faraday’s and Lenz’s laws of induction', 'Describe inductors, mutual inductance and RL transients'],
    summary: [
      'Capacitance C = Q/V; energy stored ½CV². Capacitors charge through R with time constant τ = RC.',
      'A current-carrying coil makes a magnetic field; iron concentrates it (permeability).',
      'Faraday: a changing magnetic flux induces an EMF (e = −N dΦ/dt). Lenz: it opposes the change.',
      'Inductance L opposes changes in current; energy stored ½LI²; time constant τ = L/R.',
      'A conductor carrying current in a magnetic field feels a force F = BIL (the motor principle).',
    ],
  },
  {
    subject: 'ac',
    intro: [
      'The mains supply in your home is alternating current (AC): 230 V at 50 Hz in South Africa. AC is used because transformers can step it up for efficient transmission and down again for safe use.',
      'This chapter shows how to describe sine waves, how resistors, inductors and capacitors behave with AC, what power factor means and how three-phase systems deliver power to industry.',
    ],
    question: 'What is alternating current?',
    answer: 'Alternating current is current that regularly reverses direction, normally following a sine wave. It is described by its frequency (cycles per second, Hz), its peak value and its RMS value, the effective value that does the same heating as DC.',
    outcomes: ['Relate peak, peak-to-peak and RMS values and frequency', 'Use phasors and complex numbers for AC circuits', 'Calculate reactance, impedance and resonance', 'Work with real, reactive and apparent power, power factor and three-phase power'],
    summary: [
      'Vrms = Vpeak / √2 for a sine wave; 230 V RMS mains peaks at about 325 V.',
      'XL = 2πfL rises with frequency; XC = 1/(2πfC) falls with frequency.',
      'Impedance Z = R + jX; current lags in inductive circuits and leads in capacitive ones.',
      'P = VI cos φ (W), Q = VI sin φ (VAr), S = VI (VA); power factor = P/S.',
      'Three-phase: P = √3 × VL × IL × cos φ; in star VL = √3 × Vph.',
    ],
    diagram: 'sine-wave',
  },
  {
    subject: 'machines',
    intro: [
      'Electrical machines convert energy between electrical and mechanical form, and transformers change AC voltage levels. Together they move water, air and goods, and carry power from generators to your plug.',
      'This chapter covers transformers, DC machines, induction and synchronous machines, single-phase motors, starters and machine efficiency.',
    ],
    question: 'What is an electrical machine?',
    answer: 'An electrical machine is a device that uses magnetic fields and induction to convert energy: a motor turns electrical energy into mechanical rotation, a generator turns rotation into electrical energy, and a transformer (a static machine) transfers AC energy between circuits at a different voltage.',
    outcomes: ['Use the transformer turns ratio and efficiency', 'Explain DC motors and generators', 'Explain induction motor slip and synchronous speed', 'Choose motor starters and calculate losses and efficiency'],
    summary: [
      'Transformer: V₁/V₂ = N₁/N₂ = I₂/I₁; works on AC only.',
      'Synchronous speed ns = 120f / p (rpm); a 4-pole 50 Hz motor runs near 1500 rpm.',
      'Slip s = (ns − n)/ns; induction motors typically run at 2–5 % slip.',
      'DC motor back-EMF E = V − IaRa; speed is proportional to back-EMF over flux.',
      'Efficiency η = output / input; losses are copper (I²R), iron (core), friction and windage.',
    ],
    diagram: 'transformer',
  },
  {
    subject: 'power',
    intro: [
      'Electricity is generated in power stations and solar or wind farms, stepped up to high voltage, carried across the country on transmission lines and distributed to homes and factories.',
      'This chapter follows that path and covers how the system is protected against faults, kept stable and increasingly fed by renewable energy.',
    ],
    question: 'What is a power system?',
    answer: 'A power system is the network that generates, transmits and distributes electrical energy: generators, step-up transformers, high-voltage transmission lines, substations, distribution networks and the protection that isolates faults quickly and safely.',
    outcomes: ['Describe generation, transmission and distribution', 'Use the per-unit system', 'Calculate fault levels and describe symmetrical components', 'Explain protection, stability, HVDC and solar PV'],
    summary: [
      'High transmission voltage means lower current for the same power, so lower I²R losses.',
      'Per-unit values express quantities as a fraction of a chosen base, making calculations simpler.',
      'Short-circuit faults produce very large currents; protection (relays, breakers, fuses) must clear them fast.',
      'Unbalanced faults are analysed with positive, negative and zero sequence components.',
      'Solar PV produces DC; inverters convert it to grid-synchronised AC.',
    ],
  },
  {
    subject: 'installation',
    intro: [
      'Wiring a building is governed by rules, in South Africa SANS 10142-1, so that installations are safe from shock and fire. Only a registered person may do installation work and issue a Certificate of Compliance (CoC).',
      'This chapter explains earthing, earth-leakage protection, cable sizing, lighting and socket circuits, distribution boards, inspection and testing, surge protection and workplace safety.',
    ],
    question: 'What is an electrical installation?',
    answer: 'An electrical installation is the fixed wiring, protection and equipment of a building from the point of supply onwards: the distribution board, circuits, cables, switches, socket outlets, earthing and protective devices.',
    outcomes: ['Explain the purpose of SANS 10142-1 and the CoC', 'Describe earthing and earth-leakage protection', 'Size cables for current and volt drop', 'Describe tests done before a CoC is issued'],
    summary: [
      'Earthing gives fault current a low-impedance path so protection trips quickly.',
      'An earth-leakage unit (30 mA) detects current leaking to earth and protects people from shock.',
      'Cables are sized for current-carrying capacity, volt drop and fault withstand.',
      'Tests include continuity, insulation resistance, earth loop impedance and earth-leakage trip time.',
      'Isolate, lock out, test before touching: never assume a circuit is dead.',
    ],
  },
  {
    subject: 'measurement',
    intro: [
      'You cannot repair or design what you cannot measure. A good technician knows which instrument to use, how to connect it safely and how much to trust the reading.',
      'This chapter covers multimeters, oscilloscopes, extending meter ranges, power measurement, instrument transformers and sensors.',
    ],
    question: 'What is electrical measurement?',
    answer: 'Electrical measurement is finding the value of a quantity such as voltage, current, resistance, power or frequency with an instrument, and knowing its accuracy. Voltmeters connect in parallel with what you measure; ammeters connect in series.',
    outcomes: ['Use a multimeter safely for V, A, Ω, continuity and diode tests', 'Read waveforms on an oscilloscope', 'Calculate shunts and multipliers', 'Describe CTs, VTs and common sensors'],
    summary: [
      'Voltmeter: parallel, very high resistance. Ammeter: series, very low resistance.',
      'Never measure resistance or continuity on a powered circuit.',
      'An oscilloscope shows voltage against time; read period, frequency, peak and noise from it.',
      'A shunt extends an ammeter range; a series multiplier extends a voltmeter range.',
      'Use a meter rated for the job (CAT III/IV for mains distribution work).',
    ],
  },
  {
    subject: 'electronics',
    intro: [
      'Electronics uses semiconductors to control current: diodes steer it, transistors switch and amplify it, and integrated circuits combine thousands to billions of them.',
      'This chapter goes from the PN junction to amplifiers, oscillators, power supplies and the power electronics inside every phone charger, TV and inverter.',
    ],
    question: 'What is electronics?',
    answer: 'Electronics is the branch of electrical engineering that controls the flow of electrons with active components such as diodes, transistors and integrated circuits, to rectify, amplify, switch, process signals and convert power.',
    outcomes: ['Explain semiconductors, diodes and rectifiers', 'Use BJTs and MOSFETs as switches and amplifiers', 'Design simple op-amp circuits and filters', 'Explain linear and switch-mode power supplies, converters and inverters'],
    summary: [
      'A silicon diode conducts forward at about 0.6–0.7 V and blocks reverse voltage.',
      'A bridge rectifier plus a filter capacitor turns AC into DC with some ripple.',
      'A BJT is current controlled (IC = β IB); a MOSFET is voltage controlled at the gate.',
      'An ideal op-amp with negative feedback keeps its inputs at the same voltage.',
      'Switch-mode supplies switch at high frequency for small size and high efficiency.',
    ],
    diagram: 'diode',
  },
  {
    subject: 'digital',
    intro: [
      'Digital systems represent information with two states, 0 and 1. From a simple logic gate to a microcontroller, digital circuits count, store, decide and communicate.',
      'This chapter covers number systems, logic gates, Boolean algebra, flip-flops, counters, ADCs/DACs, microcontrollers, communication buses and PLCs.',
    ],
    question: 'What is a digital system?',
    answer: 'A digital system processes information as discrete binary values (0 and 1, low and high voltage) rather than a continuous range. Logic gates combine these values, memory elements store them and processors run programs on them.',
    outcomes: ['Convert between binary, decimal and hexadecimal', 'Simplify logic with Boolean algebra and Karnaugh maps', 'Explain flip-flops, counters and registers', 'Describe ADC/DAC, microcontrollers, I²C/SPI/UART and PLCs'],
    summary: [
      'Binary is base 2, hexadecimal base 16; one hex digit = 4 bits.',
      'AND, OR and NOT are the basic gates; NAND and NOR are universal.',
      'Flip-flops store one bit; counters and registers are built from them.',
      'An n-bit ADC has 2ⁿ levels; resolution = Vref / 2ⁿ.',
      'Microcontrollers combine CPU, memory and I/O on one chip; PLCs control industrial machines.',
    ],
  },
  {
    subject: 'signals',
    intro: [
      'Signals carry information: sound, video, sensor readings, radio. Systems change signals: amplifiers, filters, controllers.',
      'This chapter introduces the mathematical tools engineers use to describe them (Fourier, Laplace, Z-transform), sampling, control systems and PID, frequency response and communication systems.',
    ],
    question: 'What is a signal?',
    answer: 'A signal is a quantity that varies with time (or space) and carries information, such as a voltage from a microphone. A system is anything that takes an input signal and produces an output signal, such as a filter or a motor controller.',
    outcomes: ['Describe signals in time and frequency', 'Use Fourier and Laplace transforms at an introductory level', 'Apply the Nyquist sampling theorem', 'Explain feedback control, PID and Bode plots'],
    summary: [
      'Any periodic signal can be built from sine waves (Fourier series).',
      'The Laplace transform turns differential equations into algebra (transfer functions).',
      'Sample at more than twice the highest frequency to avoid aliasing (Nyquist).',
      'Negative feedback reduces error; PID control combines proportional, integral and derivative action.',
      'Bode plots show gain and phase against frequency and reveal stability margins.',
    ],
  },
];

// ---- Fully authored chapter: Cells & batteries ---------------------------------------------
export interface BookSection {
  id: string;
  heading: string;
  /** Highlighted question shown above the explanation, e.g. "What is a cell?" */
  question?: string;
  body: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
  diagram?: DiagramKey;
  note?: { kind: 'tip' | 'safety'; text: string };
}

export interface QuizQuestion { id: string; prompt: string; options: string[]; answerIndex: number; explanation: string }

export interface AuthoredChapter {
  id: string;
  title: string;
  emoji: string;
  /** Place the chapter after this subject's chapter. */
  after: TheorySubjectId;
  intro: string[];
  question: string;
  answer: string;
  outcomes: string[];
  sections: BookSection[];
  summary: string[];
  keyTerms: string[];
  quiz: QuizQuestion[];
}

export const CELLS_CHAPTER: AuthoredChapter = {
  id: 'cells',
  title: 'Cells & Batteries',
  emoji: '🔋',
  after: 'fundamentals',
  intro: [
    'Torches, remote controls, phones, cars, solar systems and UPS units all depend on cells and batteries. They are the most common DC source you will meet, and one of the most common reasons a device will not work.',
    'In this chapter you will learn what a cell is, how it produces a voltage, the main types and their voltages, how to read their symbols, how to connect cells in series and parallel, and how to test, charge and handle them safely.',
  ],
  question: 'What is a cell?',
  answer: 'A cell is a single electrochemical unit that converts stored chemical energy into electrical energy. It has two electrodes, a positive and a negative, in an electrolyte. When a circuit is connected across its terminals, a chemical reaction pushes electrons around the circuit, so the cell acts as a DC voltage source. A battery is two or more cells connected together (although a single AA cell is commonly called a battery).',
  outcomes: [
    'Define a cell and a battery and name their parts',
    'Distinguish primary and secondary cells and know their typical voltages',
    'Draw and recognise the symbols for a cell and a battery',
    'Calculate voltage and capacity for cells in series and parallel',
    'Test, charge, store and dispose of cells safely',
  ],
  sections: [
    {
      id: 'parts',
      heading: 'Parts of a cell',
      question: 'What is inside a cell?',
      body: [
        'Every cell has the same basic parts. The negative electrode (anode during discharge) is a material that gives up electrons easily, such as zinc or lithium. The positive electrode (cathode during discharge) is a material that accepts electrons, such as manganese dioxide or a lithium metal oxide.',
        'Between them is the electrolyte, a paste or liquid that lets ions (charged atoms) move inside the cell but does not conduct electrons. A thin separator keeps the two electrodes from touching, because if they touched the cell would short-circuit internally.',
      ],
      diagram: 'cell-inside',
    },
    {
      id: 'how',
      heading: 'How a cell works',
      question: 'How does a cell produce a voltage?',
      body: [
        'The two electrode materials have a different tendency to give up electrons. This difference creates an electromotive force (EMF) between the terminals, even when nothing is connected.',
        'When you connect a load, a chemical reaction starts. At the negative electrode atoms are oxidised and release electrons; the electrons flow through the external circuit (the lamp or the device) to the positive electrode, where they are taken up in a reduction reaction. Inside the cell, ions travel through the electrolyte to complete the circuit. When the reacting chemicals are used up the cell is flat.',
        'A real cell also has internal resistance r. Under load some voltage is lost inside the cell, so the terminal voltage is V = E − I × r. That is why a weak cell can read a normal voltage on a meter with no load, but collapses when the device switches on.',
      ],
      note: { kind: 'tip', text: 'Test a suspect cell under load (or with a battery tester), not only open-circuit. A 1.5 V alkaline cell that drops below about 1.1 V under load is nearly flat.' },
    },
    {
      id: 'types',
      heading: 'Types of cells',
      question: 'What is the difference between primary and secondary cells?',
      body: [
        'Primary cells are used once and then discarded; their chemical reaction cannot be reversed safely. Secondary cells (rechargeable cells) can be recharged hundreds or thousands of times by pushing current back through them, which reverses the reaction.',
      ],
      table: {
        head: ['Type', 'Primary / secondary', 'Nominal voltage per cell', 'Typical use'],
        rows: [
          ['Zinc-carbon', 'Primary', '1.5 V', 'Clocks, remotes (low cost)'],
          ['Alkaline', 'Primary', '1.5 V', 'Torches, toys, remotes'],
          ['Lithium coin (e.g. CR2032)', 'Primary', '3 V', 'Motherboard CMOS, watches, car keys'],
          ['Silver-oxide', 'Primary', '1.55 V', 'Watches, calculators'],
          ['Nickel-metal hydride (NiMH)', 'Secondary', '1.2 V', 'Rechargeable AA/AAA, cordless phones'],
          ['Lead-acid', 'Secondary', '2.0 V (12 V = 6 cells)', 'Cars, UPS, alarm systems'],
          ['Lithium-ion (Li-ion)', 'Secondary', '3.6–3.7 V (4.2 V full)', 'Phones, laptops, power banks'],
          ['Lithium iron phosphate (LiFePO₄)', 'Secondary', '3.2 V', 'Solar storage, inverter batteries'],
        ],
      },
    },
    {
      id: 'symbols',
      heading: 'Circuit symbols',
      question: 'How is a cell drawn in a circuit diagram?',
      body: [
        'A cell is drawn as two parallel lines: a long thin line for the positive terminal and a short thick line for the negative terminal. A battery is drawn as several cells joined together, or as two cells with a dashed line between them, often with the total voltage written next to it.',
        'Conventional current flows out of the positive terminal, through the circuit and back into the negative terminal. Electrons actually flow the other way.',
      ],
      diagram: 'cell-symbols',
    },
    {
      id: 'series-parallel',
      heading: 'Cells in series and parallel',
      question: 'Why connect cells in series or in parallel?',
      body: [
        'In series (positive of one to negative of the next) the voltages add, but the capacity stays the same as one cell. Four 1.5 V cells in series give 6 V. In parallel (all positives together, all negatives together) the voltage stays the same as one cell, but the capacities add, so the battery lasts longer and can supply more current.',
        'Large packs combine both. A laptop pack marked "3S2P" has three groups in series, each group made of two cells in parallel: 3 × 3.7 V = 11.1 V, with twice the capacity of one cell.',
      ],
      bullets: [
        'Series: E_total = E₁ + E₂ + …; capacity (Ah) = capacity of one cell; internal resistances add.',
        'Parallel (identical cells only): E_total = E of one cell; capacity adds; internal resistance divides.',
        'Only parallel cells of the same type, age and state of charge, or current will rush from one to the other.',
      ],
      diagram: 'cells-series-parallel',
    },
    {
      id: 'capacity',
      heading: 'Capacity, energy and C-rate',
      question: 'How long will a battery last?',
      body: [
        'Capacity is the charge a cell can deliver, given in ampere-hours (Ah) or milliampere-hours (mAh). A 2000 mAh cell can in theory supply 200 mA for 10 hours. Energy is capacity times voltage: watt-hours (Wh) = V × Ah, so a 3.7 V 2000 mAh cell stores about 7.4 Wh.',
        'The C-rate describes current relative to capacity: 1C for a 2000 mAh cell is 2 A, 0.5C is 1 A. High discharge rates reduce the usable capacity and heat the cell.',
        'Runtime ≈ capacity (Ah) ÷ load current (A), but real runtime is lower because of temperature, age, high current and the device’s cut-off voltage.',
      ],
    },
    {
      id: 'practical',
      heading: 'Practical tips: testing, charging and storage',
      body: [
        'Use the right charger for the chemistry. Li-ion cells need a constant-current then constant-voltage (CC/CV) charger that stops at 4.2 V per cell; lead-acid needs a regulated charger (about 13.8 V float for a 12 V battery); NiMH chargers detect a small voltage drop at full charge.',
        'Do not mix old and new cells or different brands in one device; the weakest cell can be driven into reverse and leak. Remove alkaline cells from equipment you will store, because leaking potassium hydroxide corrodes the contacts and the board. Clean corrosion with a little vinegar or isopropyl alcohol and dry thoroughly.',
        'Store Li-ion packs cool and at about 40–60 % charge. Keep lead-acid batteries fully charged; leaving them flat causes sulphation and permanent capacity loss.',
      ],
      note: { kind: 'tip', text: 'Motherboard keeps losing time or BIOS settings? Measure the CR2032 coin cell: below about 2.8 V it should be replaced.' },
    },
    {
      id: 'safety',
      heading: 'Safety',
      body: [
        'Never short-circuit a cell or battery. Even an AA cell can make a wire red-hot, and a car battery can deliver hundreds of amperes, melt tools and cause burns. Remove rings and watches when working near battery terminals.',
        'Lithium-ion cells can catch fire (thermal runaway) if they are punctured, crushed, overcharged or overheated. Stop using any swollen, dented or hot pack, do not charge it, and keep it away from flammable material. Never try to recharge primary (non-rechargeable) cells.',
        'Lead-acid batteries give off hydrogen gas while charging: charge in a ventilated area away from sparks, and protect your eyes and skin from the sulphuric acid electrolyte. Coin cells are dangerous if swallowed by children; get emergency help immediately. Recycle used batteries at a drop-off point; do not throw them in the bin or in a fire.',
      ],
      note: { kind: 'safety', text: 'Swollen, punctured or hot lithium battery? Do not charge it or press on it. Move it outdoors onto a non-flammable surface if it is safe to do so, and dispose of it at a battery recycling point.' },
    },
  ],
  summary: [
    'A cell converts chemical energy into electrical energy; a battery is two or more cells connected together.',
    'Parts: negative electrode, positive electrode, electrolyte and separator.',
    'Primary cells are single-use (alkaline 1.5 V, lithium coin 3 V); secondary cells are rechargeable (NiMH 1.2 V, lead-acid 2 V, Li-ion 3.6–3.7 V).',
    'Terminal voltage V = E − I × r: internal resistance makes the voltage drop under load.',
    'Series: voltages add, same capacity. Parallel: same voltage, capacities add.',
    'Energy (Wh) = voltage × capacity (Ah). Use the correct charger and never short-circuit a battery.',
  ],
  keyTerms: ['Cell', 'Battery', 'Electrolyte', 'Anode', 'Cathode', 'Primary cell', 'Secondary cell', 'Electromotive force', 'Internal resistance', 'Capacity'],
  quiz: [
    { id: 'c1', prompt: 'What does a cell convert into electrical energy?', options: ['Heat energy', 'Chemical energy', 'Light energy', 'Mechanical energy'], answerIndex: 1, explanation: 'A cell stores energy in chemicals; a chemical reaction pushes electrons around the circuit.' },
    { id: 'c2', prompt: 'Which part lets ions move between the electrodes but stops electrons?', options: ['The separator only', 'The terminal cap', 'The electrolyte', 'The casing'], answerIndex: 2, explanation: 'The electrolyte conducts ions inside the cell; electrons must travel through the external circuit.' },
    { id: 'c3', prompt: 'What is the nominal voltage of one NiMH rechargeable cell?', options: ['1.2 V', '1.5 V', '2.0 V', '3.7 V'], answerIndex: 0, explanation: 'NiMH cells are 1.2 V nominal, slightly lower than a 1.5 V alkaline cell.' },
    { id: 'c4', prompt: 'Four 1.5 V cells are connected in series. What is the total EMF?', options: ['1.5 V', '3 V', '6 V', '0.375 V'], answerIndex: 2, explanation: 'In series the EMFs add: 4 × 1.5 V = 6 V.' },
    { id: 'c5', prompt: 'Two identical 2000 mAh cells are connected in parallel. What is the total capacity?', options: ['1000 mAh', '2000 mAh', '4000 mAh', '8000 mAh'], answerIndex: 2, explanation: 'In parallel the voltage stays the same and the capacities add: 2 × 2000 = 4000 mAh.' },
    { id: 'c6', prompt: 'A cell has E = 1.5 V and r = 0.5 Ω. What is its terminal voltage when supplying 0.4 A?', options: ['1.5 V', '1.3 V', '1.1 V', '0.2 V'], answerIndex: 1, explanation: 'V = E − I r = 1.5 − 0.4 × 0.5 = 1.3 V.' },
    { id: 'c7', prompt: 'In the circuit symbol for a cell, the long thin line represents…', options: ['The negative terminal', 'The positive terminal', 'The electrolyte', 'A fuse'], answerIndex: 1, explanation: 'Long thin line = positive; short thick line = negative.' },
    { id: 'c8', prompt: 'How much energy does a 3.7 V, 3000 mAh battery store?', options: ['3.7 Wh', '11.1 Wh', '1.11 Wh', '30 Wh'], answerIndex: 1, explanation: 'Wh = V × Ah = 3.7 × 3.0 = 11.1 Wh.' },
    { id: 'c9', prompt: 'Which cell is a primary (non-rechargeable) cell?', options: ['Lithium-ion', 'Lead-acid', 'Alkaline', 'NiMH'], answerIndex: 2, explanation: 'Alkaline cells are primary cells and must not be recharged.' },
    { id: 'c10', prompt: 'A phone battery has swollen. What should you do?', options: ['Charge it slowly overnight', 'Press it flat and refit it', 'Stop using it and recycle it safely', 'Puncture it to release the gas'], answerIndex: 2, explanation: 'Swelling means internal damage and a fire risk. Do not charge, press or puncture it; take it to a battery recycling point.' },
  ],
};

/** The question heading for a topic page ("What is …?"). */
export function topicQuestion(title: string): string {
  const overrides: Record<string, string> = {
    'Cost of electricity': 'How is the cost of electricity worked out?',
    'Electrical safety basics': 'How do you work safely with electricity?',
    'Heating effect': 'What is the heating effect of current?',
    'Circuit analysis': 'How do we analyse a circuit?',
  };
  if (overrides[title]) return overrides[title];
  const t = title.trim();
  if (/^(how|what|why|when)\b/i.test(t)) return t.endsWith('?') ? t : `${t}?`;
  const lower = /^[A-Z][a-z]/.test(t) && !/^[A-Z][a-z]+(’|')s\b/.test(t) && !/^(Ohm|Kirchhoff|Thevenin|Thévenin|Norton|Gauss|Maxwell|Faraday|Lenz|Karnaugh|Fourier|Laplace|Wheatstone|Bode|Boolean|Zener)/.test(t)
    ? t.charAt(0).toLowerCase() + t.slice(1) : t;
  const last = t.replace(/\(.*?\)/g, '').trim().split(/[\s-]+/).pop() || '';
  const plural = /s$/i.test(last) && !/(ss|is|us|ics)$/i.test(last);
  return `What ${plural ? 'are' : 'is'} ${lower}?`;
}
