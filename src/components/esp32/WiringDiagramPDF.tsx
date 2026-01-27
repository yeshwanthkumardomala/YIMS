import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#1a1a1a',
  },
  subheader: {
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2563eb',
    borderBottom: '1 solid #e5e5e5',
    paddingBottom: 5,
  },
  table: {
    display: 'flex',
    width: '100%',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e5e5',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 8,
  },
  diagramBox: {
    backgroundColor: '#fafafa',
    border: '1 solid #e5e5e5',
    padding: 15,
    marginBottom: 15,
    borderRadius: 4,
  },
  monoText: {
    fontFamily: 'Courier',
    fontSize: 9,
    lineHeight: 1.4,
  },
  noteBox: {
    backgroundColor: '#fff7ed',
    border: '1 solid #fed7aa',
    padding: 10,
    marginTop: 10,
    borderRadius: 4,
  },
  noteTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#c2410c',
  },
  noteText: {
    fontSize: 10,
    color: '#7c2d12',
  },
  ledSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  ledItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
    marginBottom: 5,
  },
  ledDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  componentList: {
    marginTop: 10,
  },
  componentItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 10,
  },
  bullet: {
    marginRight: 8,
    color: '#2563eb',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#999999',
    textAlign: 'center',
    borderTop: '1 solid #e5e5e5',
    paddingTop: 10,
  },
});

const WiringDiagramDocument = () => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
<Text style={styles.header}>YIMS ESP32-CAM Wiring Diagram</Text>
      <Text style={styles.subheader}>ESP32-CAM + Motherboard + LCD Display + Status LEDs + Buzzer</Text>

      {/* Components Required */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Components Required</Text>
        <View style={styles.componentList}>
          <View style={styles.componentItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>ESP32-CAM AI-Thinker Module</Text>
          </View>
          <View style={styles.componentItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>ESP32-CAM Motherboard (ESP32-CAM-MB)</Text>
          </View>
          <View style={styles.componentItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>I2C LCD Display (16x2 or 20x4) with I2C Backpack</Text>
          </View>
          <View style={styles.componentItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>LEDs: Yellow, Blue, Red (3mm or 5mm)</Text>
          </View>
          <View style={styles.componentItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>220Ω Resistors (3x for LEDs)</Text>
          </View>
          <View style={styles.componentItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>Passive Buzzer/Speaker (3-5V)</Text>
          </View>
          <View style={styles.componentItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>Jumper Wires (Female-to-Female)</Text>
          </View>
          <View style={styles.componentItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>Micro USB Cable for power and programming</Text>
          </View>
        </View>
      </View>

      {/* GPIO Connections Table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GPIO Pin Connections</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>ESP32-CAM Pin</Text>
            <Text style={styles.tableCell}>Connect To</Text>
            <Text style={styles.tableCell}>Purpose</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>GPIO 12</Text>
            <Text style={styles.tableCell}>Yellow LED (+) via 220Ω</Text>
            <Text style={styles.tableCell}>Processing indicator</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>GPIO 13</Text>
            <Text style={styles.tableCell}>Blue LED (+) via 220Ω</Text>
            <Text style={styles.tableCell}>Success indicator</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>GPIO 15</Text>
            <Text style={styles.tableCell}>Red LED (+) via 220Ω</Text>
            <Text style={styles.tableCell}>Error indicator</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>GPIO 16</Text>
            <Text style={styles.tableCell}>Buzzer (+)</Text>
            <Text style={styles.tableCell}>Audio feedback</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>GPIO 14</Text>
            <Text style={styles.tableCell}>LCD SDA</Text>
            <Text style={styles.tableCell}>I2C Data</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>GPIO 2</Text>
            <Text style={styles.tableCell}>LCD SCL</Text>
            <Text style={styles.tableCell}>I2C Clock</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>GND</Text>
            <Text style={styles.tableCell}>LEDs (-), LCD GND, Buzzer (-)</Text>
            <Text style={styles.tableCell}>Ground</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>5V</Text>
            <Text style={styles.tableCell}>LCD VCC</Text>
            <Text style={styles.tableCell}>Power</Text>
          </View>
        </View>
      </View>

      {/* Visual Diagram */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visual Wiring Diagram</Text>
        <View style={styles.diagramBox}>
          <Text style={styles.monoText}>
{`    ESP32-CAM Motherboard Setup
    ───────────────────────────
       
    ┌─────────────────────────┐
    │   ESP32-CAM-MB Board    │
    │  ┌───────────────────┐  │
    │  │    ESP32-CAM      │  │
    │  │   (plugs in here) │  │
    │  └───────────────────┘  │
    │   [USB]    [RST] [IO0]  │
    └─────────────────────────┘
          │
          │ GPIO Connections:
          │
          ├── GPIO 12 ──[220Ω]── Yellow LED (+)
          ├── GPIO 13 ──[220Ω]── Blue LED (+)
          ├── GPIO 15 ──[220Ω]── Red LED (+)
          ├── GPIO 16 ────────── Buzzer (+)
          │
          ├── GPIO 14 ────────── LCD SDA
          ├── GPIO 2  ────────── LCD SCL
          │
          ├── GND ────────────── LED(-) / LCD GND / Buzzer(-)
          └── 5V ─────────────── LCD VCC`}
          </Text>
        </View>
      </View>

      {/* LED and Audio Indicators */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LED & Audio Feedback</Text>
        <View style={styles.ledSection}>
          <View style={styles.ledItem}>
            <View style={[styles.ledDot, { backgroundColor: '#eab308' }]} />
            <Text>Yellow ON = Processing</Text>
          </View>
          <View style={styles.ledItem}>
            <View style={[styles.ledDot, { backgroundColor: '#3b82f6' }]} />
            <Text>Blue (2x) + Beep = Success</Text>
          </View>
          <View style={styles.ledItem}>
            <View style={[styles.ledDot, { backgroundColor: '#ef4444' }]} />
            <Text>Red (3x) + Long Beep = Error</Text>
          </View>
          <View style={styles.ledItem}>
            <View style={[styles.ledDot, { backgroundColor: '#f97316' }]} />
            <Text>Y+R Alt + Double Beep = Low Stock</Text>
          </View>
        </View>
      </View>

      {/* Important Notes */}
      <View style={styles.noteBox}>
        <Text style={styles.noteTitle}>Important Notes:</Text>
        <Text style={styles.noteText}>
          • Always use 220Ω resistors between GPIO pins and LED positive legs{'\n'}
          • Connect all LED negative legs and buzzer (-) to GND{'\n'}
          • Use passive buzzer (not active) for tone control via GPIO 16{'\n'}
          • LCD must have I2C backpack module (default address: 0x27 or 0x3F){'\n'}
          • The motherboard has built-in USB-to-Serial - no FTDI needed{'\n'}
          • Press IO0 button while pressing RST to enter programming mode
        </Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        YIMS - Yesh Inventory Management System • Generated for ESP32-CAM Hardware Integration
      </Text>
    </Page>
  </Document>
);

export async function generateWiringDiagramPDF() {
  const blob = await pdf(<WiringDiagramDocument />).toBlob();
  saveAs(blob, 'YIMS-ESP32-CAM-Wiring-Diagram.pdf');
}
