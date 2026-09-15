export interface BrandModelDef {
  brand: string;
  logoText: string;
  category: string;
  models: {
    name: string;
    modelCode: string;
    commonIssues: string[];
    typicalICs: string[];
    diagramImage?: string;
  }[];
}

export const BRAND_MODELS_DATA: BrandModelDef[] = [
  {
    brand: 'Apple',
    logoText: 'AAPL',
    category: 'Laptops & PCs',
    models: [
      {
        name: 'MacBook Pro 13" A1706 / A1708',
        modelCode: 'EMC 3071 / 3163 (Logic Board 820-00840)',
        commonIssues: [
          'Stuck at 5V 0.02A on USB-C power meter',
          'Flexgate stage lighting / backlight cable rupture',
          'Kernel panic caused by failed U2800 Thunderbolt chip',
          'Liquid corrosion on PPBUS_G3H fuse F7000',
        ],
        typicalICs: ['CD3215C00 (USB-PD)', 'ISL9239 (Charger IC)', 'TPS51980 (3V3/5V regulator)'],
      },
      {
        name: 'MacBook Pro 16" A2141',
        modelCode: 'EMC 3347 (Logic Board 820-01700)',
        commonIssues: [
          '5V 0.00A pulsing / T2 DFU mode boot failure',
          'Blown PP1V8_SLPS2R rail pulling PMIC down',
          'Short on PPBUS_G3H caused by U9080 NAND power stage',
          'Audio amplifier crackling / muted speakers',
        ],
        typicalICs: ['CD3217B12 (USB-PD)', 'ISL9240', 'U9080 NAND PMIC'],
      },
      {
        name: 'MacBook Air M1 A2337',
        modelCode: 'EMC 3598 (Logic Board 820-02016)',
        commonIssues: [
          'Draws 5V 0.28A and reboots continuously',
          'Liquid ingress around audio board flex connector J5100',
          'Missing PP3V3_AON rail preventing Apple Silicon PMIC start',
          'Damaged LCD eDP data line causing faint vertical purple stripe',
        ],
        typicalICs: ['Apple APL1096 PMIC', 'PI3USB32224 (Mux)', 'SN012776'],
      },
      {
        name: 'iPhone 13 / 13 Pro',
        modelCode: 'A2482 / A2638',
        commonIssues: [
          'White/Green screen of death after iOS update (display flex jumper fix)',
          'No service / searching for network (sandwich board separation)',
          'Error 4013 during iTunes restore (front earpiece sensor short)',
          'Panic log string: "Prs0" barometer sensor fault',
        ],
        typicalICs: ['PMI632 / PM6150 (Sub-PMIC)', 'Qualcomm X60 5G Baseband', 'SDR735 Transceiver'],
      },
      {
        name: 'iPhone 14 / 14 Pro',
        modelCode: 'A2650 / A2890',
        commonIssues: [
          'Dynamic Island proximity sensor loop',
          'Back glass wireless charging coil cracked trace',
          'Thermal restart every 3 minutes (missing battery gas gauge data)',
          'No flash or rear camera black preview (U3700 LDO failure)',
        ],
        typicalICs: ['A16 Bionic PMU', 'STB03 Wireless Rx', 'Skyworks 77365 Power Amp'],
      },
    ],
  },
  {
    brand: 'Sony',
    logoText: 'SONY',
    category: 'Gaming Consoles',
    models: [
      {
        name: 'PlayStation 5 Disc & Digital',
        modelCode: 'CFI-1015A / CFI-1115A / CFI-1215A',
        commonIssues: [
          'White Light of Death / No display signal (Panasonic HDMI chip destroyed)',
          'Liquid metal oxidation dry circle on APU causing 2-minute thermal shutdown',
          'Three beeps no power (Southbridge or 12V MOSFET blown)',
          'Disc feeder drive mechanical gear misalignment',
          'Rest mode crash / corrupted SSD database',
        ],
        typicalICs: ['MN864739 (HDMI 2.1)', 'SIE CXD90061GG (Southbridge)', 'MP87997 MOSFET'],
      },
      {
        name: 'PlayStation 4 Pro',
        modelCode: 'CUH-7015B / CUH-7215B',
        commonIssues: [
          'Blue Light of Death (BLOD) APU solder joint crack',
          'Jet engine fan noise (dried APU thermal paste & heatsink radiator clot)',
          'Optical drive SU-42118-6 update error (blown F201 fuse)',
          'Pulsing red light / power supply primary capacitor bulge',
        ],
        typicalICs: ['MN864729 (HDMI)', 'CXD90036G (Southbridge)', 'NCP81258 Buck Controller'],
      },
      {
        name: 'Sony WH-1000XM4 / XM5',
        modelCode: 'YY2954 / YY2958',
        commonIssues: [
          'Left earcup loud screeching/hissing ANC microphone feedback',
          'Battery dies after 10-15 minutes (internal pouch cell degradation)',
          'Power button microswitch stuck or corroded by sweat',
          'Touch sensor gesture panel unresponsive in cold weather',
        ],
        typicalICs: ['Sony QN1 HD Noise Cancelling Processor', 'SP 624038 Li-Po Cell'],
      },
    ],
  },
  {
    brand: 'Nintendo',
    logoText: 'NTDO',
    category: 'Gaming Consoles',
    models: [
      {
        name: 'Nintendo Switch HAC-001 (V1/V2)',
        modelCode: 'MOD HAC-001(-01)',
        commonIssues: [
          'Draws 0.00A at 15V / No power / Won\'t charge (M92T36 shorted)',
          'Draws 0.40A stuck at 5V / Slow charge (BQ24193 battery charger dead)',
          'Dock mode doesn\'t display on TV / Charges normally (PI3USB30532 IC failed)',
          'Joy-Con analog stick drift (potentiometer carbon track wear)',
          'Game Card reader error / Headphone jack no audio',
        ],
        typicalICs: ['M92T36 (USB-PD)', 'BQ24193 (Battery Charger)', 'PI3USB30532 (USB/DP Mux)', 'MAX77620 (PMIC)'],
      },
      {
        name: 'Nintendo Switch OLED',
        modelCode: 'HEG-001',
        commonIssues: [
          'Orange screen of death (WiFi/BT IC BCM4356XKUBG desoldered)',
          'Black screen with sound (OLED panel flex torn at latch)',
          'USB-C port physical pin bent bridging VBUS to CC pin',
          'Blown fuse on back of battery connector line',
        ],
        typicalICs: ['M92T36', 'MAX77621 (GPU Power)', 'BCM4356XKUBG (WiFi/BT)'],
      },
      {
        name: 'Nintendo Switch Lite',
        modelCode: 'HDH-001',
        commonIssues: [
          'No backlight / Dim flashlight image (Backlight driver diode open)',
          'Left D-pad membrane tear / unresponsive buttons',
          'Charges one direction only (damaged USB-C CC1 or CC2 pin)',
          'ALPS joystick drift',
        ],
        typicalICs: ['M92T36', 'Texas Instruments Backlight Driver', 'MAX77812'],
      },
    ],
  },
  {
    brand: 'Samsung',
    logoText: 'SMSG',
    category: 'Smartphones',
    models: [
      {
        name: 'Samsung Galaxy S22 / S23 Ultra',
        modelCode: 'SM-S908U / SM-S918B',
        commonIssues: [
          'Moisture detected in charging port error will not clear',
          'Green vertical line on Dynamic AMOLED after firmware update',
          'S-Pen not recognized or charging in holster',
          '100x Periscope camera focus hunting or vibrating continuously',
        ],
        typicalICs: ['Qualcomm PM8350', 'Maxim MAX77705 Companion PMIC', 'Shannon RF'],
      },
      {
        name: 'Samsung 55"/65" 4K Smart TV',
        modelCode: 'UN55NU7100 / UN65TU8000',
        commonIssues: [
          'Sound works, screen black (half screen dark edge LED strip burnout)',
          'Boot loop with red standby LED blinking twice',
          'Horizontal colored scanlines (shorted gate driver COF on panel ribbon)',
          'T-CON board missing 12V VGH / VGL rail',
        ],
        typicalICs: ['BN96-45952A LED Array', 'T-CON Level Shifter', 'Power Supply SMPS PWM'],
      },
      {
        name: 'Samsung Galaxy Tab S8 / S9',
        modelCode: 'SM-X700 / SM-X800',
        commonIssues: [
          'Charging speed capped at 5W (damaged sub-board USB daughterboard)',
          'Ghost touch registration when plugged into fast charger',
          'Magnetic keyboard pins oxidized',
        ],
        typicalICs: ['Silicon Mitus PMIC', 'Qualcomm SMB1396 Charge Pump'],
      },
    ],
  },
  {
    brand: 'Dell',
    logoText: 'DELL',
    category: 'Laptops & PCs',
    models: [
      {
        name: 'Dell XPS 13 9310 / 9320 Plus',
        modelCode: 'P145G / P151G',
        commonIssues: [
          'Blinking amber 2, white 7 diagnostic light (Display panel failure)',
          'Blinking amber 3, white 5 light (Power rail EC controller communication failure)',
          'Capacitive touch function row unresponsive',
          'Thunderbolt port loose and only charges from one side',
        ],
        typicalICs: ['MEC1515 Embedded Controller', 'TPS65988 Dual USB-PD', 'Intersil ISL95855'],
      },
      {
        name: 'Dell XPS 15 9500 / 9510 / 9520',
        modelCode: 'P91F / P107F',
        commonIssues: [
          'Battery swelling lifting the carbon fiber palmrest & trackpad',
          'DC-in jack light does not illuminate / stuck at 0.05A',
          'GPU thermal throttling under 50% CPU load',
          'Corrosion on audio jack daughterboard killing main motherboard bus',
        ],
        typicalICs: ['ISL95861 VCore Controller', 'Realtek ALC3281-CG', 'Texas Instruments Buck'],
      },
      {
        name: 'Dell Latitude 5420 / 7420',
        modelCode: 'Business Fleet Series',
        commonIssues: [
          'Amber 3, White 3 light (BIOS recovery required)',
          'USB-C port solder fatigue from heavy docking station use',
          'Fan rattling / bearing sleeve dried out',
        ],
        typicalICs: ['SMSC MEC5105 EC', 'TI TPS65994'],
      },
    ],
  },
  {
    brand: 'Microsoft',
    logoText: 'MSFT',
    category: 'Gaming Consoles',
    models: [
      {
        name: 'Xbox Series X',
        modelCode: 'Model 1882',
        commonIssues: [
          'Turns on for 2 seconds and immediately beeps off (Short on 12V rail)',
          'No video output / 640x480 resolution lock (TDP158 HDMI retimer failure)',
          'Disc drive mechanical gears stripped by foreign object',
          'Corrupted internal Western Digital 1TB M.2 2230 NVMe drive',
        ],
        typicalICs: ['TDP158 (HDMI Retimer)', 'NCP4205 PWM', 'Southbridge 1913B01'],
      },
      {
        name: 'Xbox Series S',
        modelCode: 'Model 1881',
        commonIssues: [
          'Power button illuminates but fan does not spin',
          'Black screen of death E100/E102 update error',
          'Blown 12V fuse on auxiliary power distribution board',
        ],
        typicalICs: ['TDP158 Retimer', 'Monolithic Power MP87997'],
      },
      {
        name: 'Microsoft Surface Pro 7 / 8 / 9',
        modelCode: 'Model 1866 / 1983',
        commonIssues: [
          'Surface ribbon screen jitter / screen shaking when CPU gets warm',
          'Battery expanded pushing glass screen outwards',
          'Surface Connect charging port pins burnt by metallic debris',
          'Keyboard type cover pins fail to register',
        ],
        typicalICs: ['Embedded Controller SAM', 'TI BQ25713 Charger', 'Surface Touch MCU'],
      },
    ],
  },
  {
    brand: 'Lenovo',
    logoText: 'LNV',
    category: 'Laptops & PCs',
    models: [
      {
        name: 'ThinkPad X1 Carbon (Gen 8 / 9 / 10)',
        modelCode: 'Type 20U9 / 20XW',
        commonIssues: [
          'Thunderbolt controller firmware brick (charging drops to 5V)',
          'Emergency reset hole pinhole reset required after sleep state lock',
          'TrackPoint cursor drift / mouse pointer moves on its own',
          'Fan error on boot (hall-effect sensor RPM tachometer wire severed)',
        ],
        typicalICs: ['JHL7540 Thunderbolt Controller', 'IT8586E Embedded Controller'],
      },
      {
        name: 'ThinkPad T14 / T14s (AMD & Intel)',
        modelCode: 'Type 20UD / 20W0',
        commonIssues: [
          'USB-C port cracked from motherboard pads (requires jumper wires)',
          'Screen flicker at 60Hz due to damaged 30-pin eDP cable at hinge',
          'Battery not detected error despite 90% health',
        ],
        typicalICs: ['TI BQ24780S', 'Realtek RTL8111H Ethernet'],
      },
      {
        name: 'Lenovo Legion 5 / 7 Gaming Laptop',
        modelCode: '15ARH05 / 16ACH6H',
        commonIssues: [
          'Right side hinge seized up and ripped brass threaded standoffs',
          'VCORE MOSFET blown causing instant shutdown on AC power plug-in',
          'Keyboard spacebar and WASD keys not registering',
        ],
        typicalICs: ['Alpha & Omega DrMOS AOZ5311NQI', 'ITE IT8227E-128'],
      },
    ],
  },
  {
    brand: 'Asus',
    logoText: 'ASUS',
    category: 'Laptops & PCs',
    models: [
      {
        name: 'ROG Ally Handheld Gaming PC',
        modelCode: 'RC71L',
        commonIssues: [
          'MicroSD card reader stops detecting cards (heatsink thermal baking)',
          'Left analog stick joystick drift / deadzone failure',
          'USB-C XG Mobile connector bent pins',
          'Battery stuck at 0% / Not charging with standard PD 65W chargers',
        ],
        typicalICs: ['Genesys Logic GL3224 Card Reader', 'Richtek RT9490 Charger'],
      },
      {
        name: 'ROG Zephyrus G14 / G15',
        modelCode: 'GA401 / GA402 / GA502',
        commonIssues: [
          'Plugged in USB-C charger and Barrel jack simultaneously causing blown 19V MOSFET',
          'Liquid metal spill over surface mount resistors around Ryzen APU',
          'Keyboard backlight LED failure',
        ],
        typicalICs: ['TI BQ24780S Battery Charger', 'ITE IT8987E EC'],
      },
    ],
  },
  {
    brand: 'DJI',
    logoText: 'DJI',
    category: 'Drones & Robotics',
    models: [
      {
        name: 'DJI Mini 3 / Mini 3 Pro',
        modelCode: 'MT3PD / MT3M3VD',
        commonIssues: [
          'Gimbal stuck / motor overload error 40002 (bent yaw arm)',
          'ESC board blown phase MOSFET (error 30047, motor twitching)',
          'Forward obstacle sensing calibration required error',
          'Flat flexible ribbon cable ripped at 3-axis gimbal knuckle',
        ],
        typicalICs: ['AON6884 Dual N-Channel 30V MOSFET', 'InvenSense MPU-6500 IMU'],
      },
      {
        name: 'DJI Air 2S / Mavic Air 2',
        modelCode: 'DAS8 / DA2S',
        commonIssues: [
          'Battery hibernation state (LEDs will not blink, need unlock over I2C)',
          'Downward vision sensor glass cracked',
          'O3 transmission disconnection after 100m (blown RF amplifier module)',
        ],
        typicalICs: ['Texas Instruments BQ40Z307 Battery Gas Gauge', 'Skyworks RF PA'],
      },
    ],
  },
  {
    brand: 'LG',
    logoText: 'LG',
    category: 'TVs & Monitors',
    models: [
      {
        name: 'LG OLED C1 / C2 / C3 Series',
        modelCode: 'OLED55C1PUB / OLED65C2PUA',
        commonIssues: [
          'Red standby light clicks once, relay clicks off immediately (Power board protection)',
          'Horizontal thin black line 3 inches from top of panel',
          'HDMI port 2 (eARC) stops receiving surround sound audio',
          'WiFi / Magic Remote Bluetooth disconnected error (faulty ribbon cable to bottom IR sensor)',
        ],
        typicalICs: ['EAY65895511 SMPS Power Board', 'LG Alpha 9 Gen 5 Processor', 'T-CON 6870C'],
      },
      {
        name: 'LG UltraGear 27" / 32" Gaming Monitor',
        modelCode: '27GP850 / 32GP850',
        commonIssues: [
          'DisplayPort no signal message (DisplayPort connector cracked solder joints)',
          'Screen flicker at 165Hz / works fine at 60Hz',
          '19V DC barrel jack socket center pin pushed backwards',
        ],
        typicalICs: ['Realtek Display Scaler', 'Buck Converter 5V/3.3V'],
      },
    ],
  },
  {
    brand: 'Espressif & Raspberry Pi',
    logoText: 'IOT',
    category: 'Microcontrollers & IoT',
    models: [
      {
        name: 'Raspberry Pi 4 Model B (2GB/4GB/8GB)',
        modelCode: 'RPi4B',
        commonIssues: [
          'USB-C CC line resistor omitted issue (won\'t power from e-marked chargers)',
          'Red power LED on, green ACT LED off (corrupted EEPROM bootloader or blown PMIC)',
          '3.3V rail dead / shorted (destroyed MXL7704 power management chip)',
          'Micro HDMI port ripped off board pads',
        ],
        typicalICs: ['MaxLinear MXL7704-AQB PMIC', 'Broadcom BCM2711 SoC'],
      },
      {
        name: 'ESP32 Development Board (ESP-WROOM-32)',
        modelCode: 'NodeMCU-32S / DevKit v1',
        commonIssues: [
          'Brownout detector was triggered on WiFi transmission burst (add 100uF capacitor)',
          'CH340G / CP2102 USB UART bridge device not recognized',
          'AMS1117 3.3V LDO regulator smoking hot when powered with 5V',
          'GPIO0 boot button fails to pull down to enter flashing mode',
        ],
        typicalICs: ['AMS1117-3.3 LDO', 'CP2102 USB-to-UART', 'ESP32-D0WDQ6'],
      },
    ],
  },
];
