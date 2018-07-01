#############################################################
# Flag Signal App v0.1
# 
# Created by Justinas Saldukas, jsaldukas@gmail.com
#############################################################
# Configuration:

#
#############################################################

appName = "ahaa"
logPrefix = appName + ": "
appFolder = "apps/python/" + appName
lapsFolder = appFolder + "/laps"

import ac
import acsys
import math
import csv
import datetime
import sys
import traceback
import os
import configparser
# import os, platform, sys
# if platform.architecture()[0] == "64bit":
    # sys.path.insert(0, "apps/python/" + appName + "/stdlib64")
# else:
    # sys.path.insert(0, "apps/python/" + appName + "/stdlib")
# os.environ['PATH'] = os.environ['PATH'] + ";."
#import ctypes

ac.log(logPrefix + "Started, version v0.1")

appWindow = 0
label1 = 0
telemetrySession = 0
cfg = 0
ui_enableButton = 0

class Configuration:
    def __init__(self):
        self.enable = 0
    def load(self):
        config = configparser.SafeConfigParser()
        try:
            config.read(appFolder + "/config.ini")
            self.enable = config.get(appName, "enable") == "1"
            ac.log(logPrefix + "Config loaded!")
        except Exception as e:
            ac.log(logPrefix + "Config load ERROR. type=%s" % (type(e)), 1)
    def save(self):
        config = configparser.SafeConfigParser()
        try:
            config.add_section(appName)
            config.set(appName, "enable", self.enable)
            with open(appFolder + "/config.ini", "w") as config_file:
                config.write(config_file)
            ac.log(logPrefix + "Config saved!")
        except Exception as e:
            ac.log(logPrefix + "Config save ERROR. type=%s" % (type(e)), 1)
    
class LapTelemetry:
    def __init__(self, carName, trackNameConfig, serverName, lapNumber):
        global appFolder, logPrefix
        
        datetimeStr = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
        self.fileextension = ".csv"
        self.filename = datetimeStr + "__" + trackNameConfig + "__" + carName + "__" + str(lapNumber) + self.fileextension
        self.filepath = lapsFolder + "/" + self.filename
        
        self.file = open(self.filepath, "w", newline="")
        self.filewriter = csv.writer(self.file, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
        self.file.flush()
        
        self.lapNumber = lapNumber
        self.headersWritten = False
    
    def addData(self, data):
        if not self.headersWritten:
            self.filewriter.writerow(list(data.keys()))
            self.headersWritten = True
            
        self.filewriter.writerow(list(data.values()))
        
    def __formatLapTimeForFilename(self, lapTimeMs):
        text = "{:02d}m{:02d}.{:03d}s".format(int(lapTimeMs / 60000), int(lapTimeMs / 1000 % 60), int(lapTimeMs % 1000))
        return text
    
    def finish(self, lapTimeMs):
        self.file.close()
        self.file = 0
        newFilepath = ('.').join(self.filepath.split('.')[:-1]) + "__" + self.__formatLapTimeForFilename(lapTimeMs) + self.fileextension
        os.rename(self.filepath, newFilepath)

class TelemetrySession:
    def start(self, carName, trackName, trackConfig, trackLength, interval = 100):
        self.__reset()
        self.sessionData = {
            "carName": carName, 
            "trackName": trackName, 
            "trackConfig": trackConfig, 
            "trackLength": trackLength
        }
        self.interval = interval
    
    def finish(self):
        if self.currentLapTelemetry:
            self.currentLapTelemetry.finish(self.lastRecordedLapTime)
            
        self.__reset()
        
    def __reset(self):
        self.currentLapTelemetry = 0
        self.lastLapTime = -1
        self.lastData = 0
        self.lastRecordedLapTime = -1
    
    def __debug(self, method, msg):
        global logPrefix
        ac.console(logPrefix + "{}: {}".format(method, msg))
        
    def frame(self, lap, lapTimeMs, lastLapTimeMs, trackPosition, worldPosition, accG, speedKmh, lapInvalidated, gas, brake, gear):
        
        if not self.currentLapTelemetry or self.currentLapTelemetry.lapNumber != lap:
            self.__debug("frame", "Lap change to {}".format(lap))
            if self.currentLapTelemetry:
                if self.lastData:
                    # use exact result lap time as calculated by AC as last record in telemetry
                    self.lastData["lapTimeMs"] = lastLapTimeMs
                    self.currentLapTelemetry.addData(self.lastData)
                self.currentLapTelemetry.finish(lastLapTimeMs)
                self.__debug("frame", "Finished lap {}".format(self.currentLapTelemetry.lapNumber))
            
            self.currentLapTelemetry = LapTelemetry(
                carName = self.sessionData["carName"], 
                trackNameConfig = self.sessionData["trackName"] + '_' + self.sessionData["trackConfig"], 
                serverName = '', 
                lapNumber = lap)
                
            self.__debug("frame", "Started new lap: " + self.currentLapTelemetry.filename)
        
        data = {
            "lapTimeMs": lapTimeMs,
            "lap": lap,
            "trackPosition": trackPosition,
            "speedKmh": speedKmh,
            "lapInvalidated": lapInvalidated,
            "gas": gas,
            "brake": brake,
            "gear": gear,
            "pos_x": worldPosition[0],
            "pos_y": worldPosition[1],
            "pos_z": worldPosition[2],
            "accg_x": accG[0],
            "accg_y": accG[1],
            "accg_z": accG[2],
        }
        
        # Only log every 100 ms or on start/finish
        if (self.lastLapTime < 0 or self.lastLapTime > lapTimeMs or lapTimeMs - self.lastRecordedLapTime >= self.interval) \
            and (not self.lastData or round(self.lastData["trackPosition"], 5) != round(data["trackPosition"], 5)):
            self.currentLapTelemetry.addData(data)
            self.lastRecordedLapTime = lapTimeMs
            
        self.lastData = data
        self.lastLapTime = lapTimeMs
    
def printExceptionInfo(contextName=''):
    global logPrefix
    ac.console(logPrefix + "Exception[{}]: {}".format(contextName, traceback.format_exc(1)))
    ac.log(logPrefix + "Exception[{}]: {}".format(contextName, traceback.format_exc()))

def startTelemetry():
    global logPrefix, telemetrySession
    
    telemetrySession = TelemetrySession()
    
    trackName = ac.getTrackName(0)
    trackConfig = ac.getTrackConfiguration(0)
    trackLength = ac.getTrackLength(0)
    carName = ac.getCarName(0)
    
    telemetrySession.start(
        carName = carName, 
        trackName = trackName, 
        trackConfig = trackConfig, 
        trackLength = trackLength)
        
def stopTelemetry():
    global telemetrySession
    
    if telemetrySession:
        telemetrySession.finish()
        telemetrySession = 0
    
def onRender(delta_t):
    global label1, appWindow, telemetrySession
    
    ac.setBackgroundOpacity(appWindow, 0)
    
    speedKmh = ac.getCarState(0, acsys.CS.SpeedKMH)
    lapTimeMs = ac.getCarState(0, acsys.CS.LapTime)
    lastLapTimeMs = ac.getCarState(0, acsys.CS.LastLap)
    lapInvalidated = ac.getCarState(0, acsys.CS.LapInvalidated)
    trackPosition = ac.getCarState(0, acsys.CS.NormalizedSplinePosition)
    worldPosition = ac.getCarState(0, acsys.CS.WorldPosition)
    accG = ac.getCarState(0, acsys.CS.AccG)
    lapCount = ac.getCarState(0, acsys.CS.LapCount)
    gas = ac.getCarState(0, acsys.CS.Gas)
    brake = ac.getCarState(0, acsys.CS.Brake)
    gear = ac.getCarState(0, acsys.CS.Gear)
    
    ac.setText(label1, "TrackPos: {}\r\nSpeed: {}\r\nLap: {}\r\nLapTime: {} (invalid:{})\r\nWorldPos: {};{};{}".format(trackPosition, speedKmh, lapCount, lapTimeMs, lapInvalidated, worldPosition[0], worldPosition[1], worldPosition[2]))
    
    if telemetrySession:
        try:
            telemetrySession.frame(
                lap = lapCount,
                lapTimeMs = lapTimeMs,
                lastLapTimeMs = lastLapTimeMs,
                lapInvalidated = lapInvalidated,
                trackPosition = trackPosition,
                worldPosition = worldPosition,
                accG = accG,
                speedKmh = speedKmh,
                gas = gas,
                brake = brake,
                gear = gear)
        except:
            printExceptionInfo("onRender:call frame()")
            
def onEnableButtonClicked():
    global cfg, ui_enableButton
    
    ac.console(logPrefix + "Enable button clicked")
    
    if cfg.enable > 0:
        cfg.enable = 0
        ac.setText(ui_enableButton, "Enable")
        stopTelemetry()
    else:
        cfg.enable = 1
        ac.setText(ui_enableButton, "Disable")
        startTelemetry()
        
    cfg.save()
    
            # This function gets called by AC when the Plugin is initialised
# The function has to return a string with the plugin name
def acMain(ac_version):
    global appWindow, label1, logPrefix, appName, cfg, ui_enableButton
    ac.console(logPrefix + "acMain")
    try:
        appWindow = ac.newApp(appName)
        
        cfg = Configuration()
        cfg.load()
        
        ac.setTitle(appWindow, "")
        ac.setSize(appWindow, 400, 200)
        ac.drawBorder(appWindow, 0)
        ac.setBackgroundOpacity(appWindow, 0)
        
        ac.addRenderCallback(appWindow, onRender)
        
        ui_enableButton = ac.addButton(appWindow, "Enable")
        ac.setPosition(ui_enableButton, 0, 30)
        ac.setSize(ui_enableButton, 70, 30)
        ac.addOnClickedListener(ui_enableButton, onEnableButtonClicked)
        
        label1 = ac.addLabel(appWindow, "____")
        ac.setPosition(label1, 0, 65)
        
        if cfg.enable > 0:
            ac.setText(ui_enableButton, "Disable")
            startTelemetry()
            
        ac.console(logPrefix + "Initialized")
    except:
        printExceptionInfo("acMain")
    
    return appName
