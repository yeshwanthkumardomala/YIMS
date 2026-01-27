import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Cpu,
  Wifi,
  Camera,
  Cable,
  Code,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  ArrowLeft,
  Zap,
  Package,
  MapPin,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ESP32AdminDashboard } from '@/components/esp32/ESP32AdminDashboard';

const SUPABASE_PROJECT_ID = 'cejaafrdxajcjyutettr';

const arduinoCode = `/*
 * YIMS ESP32-CAM QR Code Scanner
 * 
 * This code scans QR codes and sends them to YIMS server
 * for instant item/location lookup.
 * 
 * Hardware: ESP32-CAM AI-Thinker
 * Libraries required:
 *   - ESP32QRCodeReader (by alvarowolfx)
 *   - ArduinoJson (by Benoit Blanchon)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "ESP32QRCodeReader.h"

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const char* WIFI_SSID = "YOUR_WIFI_SSID";        // Your WiFi network name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // Your WiFi password
const char* DEVICE_ID = "ESP32-CAM-01";          // Unique ID for this scanner

// YIMS Server URL (pre-configured for your project)
const char* SERVER_URL = "https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/esp32-scan";

// ============================================
// PIN DEFINITIONS
// ============================================
#define FLASH_LED_PIN 4   // Built-in flash LED on ESP32-CAM

// ============================================
// GLOBAL VARIABLES
// ============================================
ESP32QRCodeReader reader(CAMERA_MODEL_AI_THINKER);
bool wifiConnected = false;
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 3000; // 3 seconds between scans

// ============================================
// SETUP
// ============================================
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("========================================");
  Serial.println("   YIMS ESP32-CAM QR Code Scanner");
  Serial.println("========================================");
  
  // Initialize flash LED
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);
  
  // Connect to WiFi
  connectWiFi();
  
  // Initialize camera
  Serial.println("Initializing camera...");
  reader.setup();
  reader.beginOnCore(1);
  Serial.println("Camera initialized!");
  
  // Flash LED 3 times to indicate ready
  for (int i = 0; i < 3; i++) {
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(100);
    digitalWrite(FLASH_LED_PIN, LOW);
    delay(100);
  }
  
  Serial.println("Ready to scan QR codes!");
  Serial.println("----------------------------------------");
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    connectWiFi();
  }
  
  // Try to read QR code
  struct QRCodeData qrCodeData;
  if (reader.receiveQrCode(&qrCodeData, 100)) {
    if (qrCodeData.valid) {
      String code = (const char*)qrCodeData.payload;
      
      // Check cooldown
      if (millis() - lastScanTime > SCAN_COOLDOWN) {
        lastScanTime = millis();
        
        Serial.println();
        Serial.println("========================================");
        Serial.print("QR Code detected: ");
        Serial.println(code);
        
        // Send to YIMS server
        sendToYIMS(code);
        
        Serial.println("========================================");
      }
    }
  }
}

// ============================================
// WIFI CONNECTION
// ============================================
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("WiFi connection failed!");
  }
}

// ============================================
// SEND SCAN TO YIMS SERVER
// ============================================
void sendToYIMS(String code) {
  if (!wifiConnected) {
    Serial.println("ERROR: WiFi not connected");
    blinkError();
    return;
  }
  
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // 10 second timeout
  
  // Create JSON payload
  StaticJsonDocument<256> doc;
  doc["code"] = code;
  doc["device_id"] = DEVICE_ID;
  
  String payload;
  serializeJson(doc, payload);
  
  Serial.print("Sending to server... ");
  
  // Send POST request
  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    String response = http.getString();
    Serial.println("Response received!");
    
    // Parse response
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error) {
      bool success = responseDoc["success"];
      
      if (success) {
        const char* type = responseDoc["type"];
        JsonObject data = responseDoc["data"];
        
        Serial.println();
        Serial.print("Type: ");
        Serial.println(type);
        
        if (strcmp(type, "item") == 0) {
          Serial.print("Name: ");
          Serial.println(data["name"].as<const char*>());
          Serial.print("Stock: ");
          Serial.print(data["current_stock"].as<int>());
          Serial.print(" ");
          Serial.println(data["unit"].as<const char*>());
          
          int stock = data["current_stock"].as<int>();
          int minStock = data["minimum_stock"].as<int>();
          
          if (stock <= 0) {
            Serial.println("STATUS: OUT OF STOCK!");
            blinkWarning();
          } else if (stock <= minStock) {
            Serial.println("STATUS: LOW STOCK");
            blinkWarning();
          } else {
            blinkSuccess();
          }
        } else {
          Serial.print("Location: ");
          Serial.println(data["name"].as<const char*>());
          Serial.print("Type: ");
          Serial.println(data["location_type"].as<const char*>());
          blinkSuccess();
        }
      } else {
        const char* errorMsg = responseDoc["error"];
        Serial.print("Error: ");
        Serial.println(errorMsg);
        blinkError();
      }
    } else {
      Serial.println("JSON parse error");
      blinkError();
    }
  } else {
    Serial.print("HTTP Error: ");
    Serial.println(httpCode);
    blinkError();
  }
  
  http.end();
}

// ============================================
// LED FEEDBACK FUNCTIONS
// ============================================
void blinkSuccess() {
  // 2 quick blinks = success
  for (int i = 0; i < 2; i++) {
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(100);
    digitalWrite(FLASH_LED_PIN, LOW);
    delay(100);
  }
}

void blinkError() {
  // 5 rapid blinks = error
  for (int i = 0; i < 5; i++) {
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(50);
    digitalWrite(FLASH_LED_PIN, LOW);
    delay(50);
  }
}

void blinkWarning() {
  // 3 slow blinks = warning (low stock)
  for (int i = 0; i < 3; i++) {
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(300);
    digitalWrite(FLASH_LED_PIN, LOW);
    delay(300);
  }
}
`.replace('${SUPABASE_PROJECT_ID}', SUPABASE_PROJECT_ID);

export default function ESP32Integration() {
  const [copiedCode, setCopiedCode] = useState(false);
  const { isAdmin } = useAuth();

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(arduinoCode);
      setCopiedCode(true);
      toast.success('Arduino code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  const hardwareItems = [
    { name: 'ESP32-CAM AI-Thinker Module', price: '₹500-800', required: true },
    { name: 'ESP32-CAM Motherboard (MB)', price: '₹150-250', required: true },
    { name: 'I2C LCD Display (16x2 or 20x4)', price: '₹150-300', required: false },
    { name: 'LED Kit (Yellow, Blue, Red)', price: '₹30-50', required: false },
    { name: 'Micro USB Cable', price: '₹50-100', required: true },
    { name: '5V Power Supply or USB Power Bank', price: '₹100-300', required: false },
  ];

  const wiringConnections = [
    { esp32: 'ESP32-CAM', ftdi: 'Motherboard Slot', color: 'text-primary' },
    { esp32: 'GPIO 12', ftdi: 'Yellow LED (+)', color: 'text-yellow-500' },
    { esp32: 'GPIO 13', ftdi: 'Blue LED (+)', color: 'text-blue-500' },
    { esp32: 'GPIO 15', ftdi: 'Red LED (+)', color: 'text-red-500' },
    { esp32: 'GPIO 14 (SDA)', ftdi: 'LCD SDA', color: 'text-green-500' },
    { esp32: 'GPIO 2 (SCL)', ftdi: 'LCD SCL', color: 'text-cyan-500' },
    { esp32: 'GND', ftdi: 'LED (-) / LCD GND', color: 'text-muted-foreground' },
    { esp32: '5V', ftdi: 'LCD VCC', color: 'text-red-500' },
  ];

  const troubleshootingItems = [
    {
      problem: 'Camera not initializing',
      solutions: [
        'Check that you selected "AI Thinker ESP32-CAM" as the board',
        'Ensure camera ribbon cable is properly connected',
        'Try pressing the reset button on ESP32-CAM',
      ],
    },
    {
      problem: 'WiFi connection fails',
      solutions: [
        'Verify SSID and password are correct',
        'Make sure the ESP32 is within WiFi range',
        'Check if your WiFi uses 2.4GHz (5GHz not supported)',
      ],
    },
    {
      problem: 'Upload fails with timeout',
      solutions: [
        'Connect IO0 to GND before uploading',
        'Press and hold RESET button, release after upload starts',
        'Try a different USB port or cable',
      ],
    },
    {
      problem: 'QR codes not scanning',
      solutions: [
        'Ensure adequate lighting on the QR code',
        'Hold the camera 10-20cm from the code',
        'Make sure QR code is not damaged or blurry',
      ],
    },
    {
      problem: 'HTTP errors from server',
      solutions: [
        'Check WiFi connection is stable',
        'Verify the server URL is correct',
        'Check serial monitor for specific error codes',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/how-to-use">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Help
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">ESP32-CAM Integration</h1>
              <p className="text-muted-foreground">
                Set up a dedicated hardware QR code scanner for YIMS
              </p>
            </div>
          </div>
        </div>

        {/* Overview Alert */}
        <Alert className="mb-8 border-primary/20 bg-primary/5">
          <Zap className="h-4 w-4" />
          <AlertTitle>What is this?</AlertTitle>
          <AlertDescription>
            The ESP32-CAM is a low-cost WiFi camera module that can act as a dedicated scanning
            station for YIMS. When it scans a QR code, it instantly looks up the item or location
            and can provide LED feedback — all without needing a phone or computer!
          </AlertDescription>
        </Alert>

        {/* How It Works */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                <Camera className="h-8 w-8 mb-2 text-primary" />
                <p className="font-medium">1. Scan QR Code</p>
                <p className="text-sm text-muted-foreground">ESP32-CAM camera reads code</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                <Wifi className="h-8 w-8 mb-2 text-primary" />
                <p className="font-medium">2. Send via WiFi</p>
                <p className="text-sm text-muted-foreground">HTTP POST to YIMS server</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                <Package className="h-8 w-8 mb-2 text-primary" />
                <p className="font-medium">3. Database Lookup</p>
                <p className="text-sm text-muted-foreground">Find item or location</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                <CheckCircle2 className="h-8 w-8 mb-2 text-primary" />
                <p className="font-medium">4. LED Feedback</p>
                <p className="text-sm text-muted-foreground">Blink to show result</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="hardware" className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-2 md:grid-cols-6' : 'grid-cols-2 md:grid-cols-5'}`}>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
            <TabsTrigger value="wiring">Wiring</TabsTrigger>
            <TabsTrigger value="setup">IDE Setup</TabsTrigger>
            <TabsTrigger value="code">Arduino Code</TabsTrigger>
            <TabsTrigger value="troubleshoot">Troubleshoot</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </TabsTrigger>
            )}
          </TabsList>

          {/* Hardware Requirements */}
          <TabsContent value="hardware">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Hardware Requirements
                </CardTitle>
                <CardDescription>
                  Everything you need to build your ESP32-CAM scanner
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {hardwareItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={item.required ? 'default' : 'secondary'}>
                          {item.required ? 'Required' : 'Optional'}
                        </Badge>
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <IndianRupee className="h-4 w-4" />
                        <span>{item.price.replace('₹', '')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <span className="font-semibold">Estimated Total</span>
                  <div className="flex items-center gap-1 text-lg font-bold">
                    <IndianRupee className="h-5 w-5" />
                    <span>700 - 1200</span>
                  </div>
                </div>

                <Alert>
                  <MapPin className="h-4 w-4" />
                  <AlertTitle>Where to Buy</AlertTitle>
                  <AlertDescription>
                    These components are available on Amazon, Flipkart, Robu.in, or local
                    electronics stores. Search for "ESP32-CAM Motherboard" for the all-in-one programmer board.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wiring Diagram */}
          <TabsContent value="wiring">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cable className="h-5 w-5" />
                  Wiring Diagram
                </CardTitle>
                <CardDescription>
                  Connect ESP32-CAM to Motherboard, LCD display, and status LEDs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Connection Table */}
                  <div>
                    <h4 className="font-medium mb-3">Connections</h4>
                    <div className="space-y-2">
                      {wiringConnections.map((conn, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-2 rounded bg-muted/50"
                        >
                          <code className={`font-mono font-bold ${conn.color}`}>
                            {conn.esp32}
                          </code>
                          <span className="text-muted-foreground">→</span>
                          <code className="font-mono">{conn.ftdi}</code>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visual Diagram */}
                  <div className="p-4 rounded-lg border bg-muted/20">
                    <h4 className="font-medium mb-3 text-center">Visual Reference</h4>
                    <pre className="text-xs font-mono leading-relaxed">
{`
   ESP32-CAM Motherboard Setup
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
         ├── GPIO 12 ── Yellow LED (+)
         ├── GPIO 13 ── Blue LED (+)
         ├── GPIO 15 ── Red LED (+)
         ├── GPIO 14 ── LCD SDA
         ├── GPIO 2  ── LCD SCL
         ├── GND ───── LED(-) / LCD GND
         └── 5V ────── LCD VCC
`}
                    </pre>
                  </div>
                </div>

                <Alert className="border-primary/20 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>ESP32-CAM Motherboard Advantage</AlertTitle>
                  <AlertDescription>
                    The motherboard eliminates complex FTDI wiring. Simply plug the ESP32-CAM into the slot, 
                    connect USB, and upload code directly. The IO0 button handles programming mode automatically!
                  </AlertDescription>
                </Alert>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>LED Wiring Notes</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>
                        Use 220Ω resistors between GPIO pins and LED positive legs
                      </li>
                      <li>Connect all LED negative legs to GND</li>
                      <li>For LCD: Make sure to use I2C LCD module with backpack</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arduino IDE Setup */}
          <TabsContent value="setup">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Arduino IDE Setup
                </CardTitle>
                <CardDescription>
                  Step-by-step software installation guide
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                      1
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Download Arduino IDE</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Download and install Arduino IDE from the official website
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href="https://www.arduino.cc/en/software"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Download Arduino IDE
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                      2
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Add ESP32 Board Package</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Go to <strong>File → Preferences</strong> and add this URL to "Additional
                        Boards Manager URLs":
                      </p>
                      <code className="block p-2 rounded bg-muted text-xs break-all">
                        https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
                      </code>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                      3
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Install ESP32 Board</h4>
                      <p className="text-sm text-muted-foreground">
                        Go to <strong>Tools → Board → Boards Manager</strong>, search for "esp32"
                        and install "ESP32 by Espressif Systems"
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                      4
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Install Required Libraries</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Go to <strong>Sketch → Include Library → Manage Libraries</strong> and
                        install:
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li>
                          <strong>ESP32QRCodeReader</strong> by alvarowolfx
                        </li>
                        <li>
                          <strong>ArduinoJson</strong> by Benoit Blanchon
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                      5
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Select Board and Port</h4>
                      <p className="text-sm text-muted-foreground">
                        Go to <strong>Tools → Board</strong> and select{' '}
                        <strong>"AI Thinker ESP32-CAM"</strong>. Then select your COM port under{' '}
                        <strong>Tools → Port</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arduino Code */}
          <TabsContent value="code">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Arduino Code
                  </span>
                  <Button onClick={copyCode} variant="outline" size="sm">
                    {copiedCode ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Code
                      </>
                    )}
                  </Button>
                </CardTitle>
                <CardDescription>
                  Complete code for ESP32-CAM — just update WiFi credentials!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Before Uploading</AlertTitle>
                  <AlertDescription>
                    Update the <code className="px-1 bg-muted rounded">WIFI_SSID</code> and{' '}
                    <code className="px-1 bg-muted rounded">WIFI_PASSWORD</code> values in the
                    code with your WiFi credentials.
                  </AlertDescription>
                </Alert>

                <ScrollArea className="h-[500px] rounded-lg border">
                  <pre className="p-4 text-xs font-mono bg-muted/30">
                    <code>{arduinoCode}</code>
                  </pre>
                </ScrollArea>

                <div className="mt-4 p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">LED Feedback Patterns</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>2 quick blinks = Success</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>3 slow blinks = Low stock warning</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>5 rapid blinks = Error</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Troubleshooting */}
          <TabsContent value="troubleshoot">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Troubleshooting
                </CardTitle>
                <CardDescription>Common problems and solutions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {troubleshootingItems.map((item, index) => (
                    <div key={index} className="p-4 rounded-lg border">
                      <h4 className="font-medium text-destructive mb-2">{item.problem}</h4>
                      <ul className="space-y-1">
                        {item.solutions.map((solution, sIndex) => (
                          <li
                            key={sIndex}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                            {solution}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Dashboard - Only visible to admins */}
          {isAdmin && (
            <TabsContent value="admin">
              <ESP32AdminDashboard />
            </TabsContent>
          )}
        </Tabs>

        {/* API Testing Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Test the API Endpoint</CardTitle>
            <CardDescription>
              You can test the ESP32 API endpoint using curl or any HTTP client
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-muted/50 font-mono text-sm">
              <p className="text-muted-foreground mb-2"># Test with curl:</p>
              <code className="break-all">
                curl -X POST https://{SUPABASE_PROJECT_ID}.supabase.co/functions/v1/esp32-scan \<br />
                {'  '}-H "Content-Type: application/json" \<br />
                {'  '}-d '&#123;"code": "YIMS:ITEM:00001", "device_id": "test-device"&#125;'
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
