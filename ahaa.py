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
#uploadUrl = 

import ac
import acsys
import math
import csv
import datetime
import sys
import traceback
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

class LapTelemetry:
    def __init__(self, carName, trackNameConfig, serverName, lapNumber):
        global appFolder, logPrefix
        
        datetimeStr = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
        self.filename = datetimeStr + "_" + trackNameConfig + "__" + carName + "_" + str(lapNumber) + ".csv"
        filepath = appFolder + "/" + self.filename
        
        self.file = open(filepath, "w", newline="")
        self.filewriter = csv.writer(self.file, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
        self.file.flush()
        
        self.lapNumber = lapNumber
        self.headersWritten = False
    
    def addData(self, data):
        if not self.headersWritten:
            self.filewriter.writerow(list(data.keys()))
            self.headersWritten = True
            
        self.filewriter.writerow(list(data.values()))
    
    def finish(self):
        self.file.close()
        self.file = 0

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
        self.__reset()
        
    def __reset(self):
        self.currentLapTelemetry = 0
        self.lastLapTime = -1
        self.lastData = 0
        self.lastRecordedLapTime = -1
    
    def __debug(self, method, msg):
        global logPrefix
        ac.console(logPrefix + "{}: {}".format(method, msg))
        
    def frame(self, lap, lapTimeMs, lastLapTimeMs, trackPosition, speedKmh, lapInvalidated, gas, brake, gear):
        
        if not self.currentLapTelemetry or self.currentLapTelemetry.lapNumber != lap:
            self.__debug("frame", "Lap change to {}".format(lap))
            if self.currentLapTelemetry:
                if self.lastData:
                    # use exact result lap time as calculated by AC as last record in telemetry
                    self.lastData["lapTimeMs"] = lastLapTimeMs
                    self.currentLapTelemetry.addData(self.lastData)
                self.currentLapTelemetry.finish()
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
            "gear": gear
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
    
def onActivate(*args):
    global logPrefix, telemetrySession
    ac.console(logPrefix + "onActivate()")
    try:
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
    except:
        printExceptionInfo("onActivate")
    
def onDismiss(*args):
    global logPrefix, telemetrySession
    ac.console(logPrefix + "onDismiss()")
    try:
        if telemetrySession:
            telemetrySession.finish()
            telemetrySession = 0
    except:
        printExceptionInfo("onDismiss")
    
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
    
    ac.setText(label1, "1TrackPos: {}\r\nSpeed: {}\r\nLap: {}\r\nLapTime: {} (invalid:{})\r\nWorldPos: {};{};{}".format(trackPosition, speedKmh, lapCount, lapTimeMs, lapInvalidated, worldPosition[0], worldPosition[1], worldPosition[2]))
    
    if telemetrySession:
        try:
            telemetrySession.frame(
                lap = lapCount,
                lapTimeMs = lapTimeMs,
                lastLapTimeMs = lastLapTimeMs,
                lapInvalidated = lapInvalidated,
                trackPosition = trackPosition,
                speedKmh = speedKmh,
                gas = gas,
                brake = brake,
                gear = gear)
        except:
            printExceptionInfo("onRender:call frame()")
            
# This function gets called by AC when the Plugin is initialised
# The function has to return a string with the plugin name
def acMain(ac_version):
    global appWindow, label1, logPrefix, appName
    ac.console(logPrefix + "acMain")
    try:
        appWindow = ac.newApp(appName)
        ac.setTitle(appWindow, "")
        ac.setSize(appWindow, 400, 200)
        ac.drawBorder(appWindow, 0)
        ac.setBackgroundOpacity(appWindow, 0)
        
        label1 = ac.addLabel(appWindow, "____")
        ac.setPosition(label1, 0, 30)
        
        ac.addRenderCallback(appWindow, onRender)
        ac.addOnAppActivatedListener(appWindow, onActivate)
        ac.addOnAppDismissedListener(appWindow, onDismiss)
        
        ac.console(logPrefix + "Initialized")
    except:
        printExceptionInfo("acMain")
    
    return appName
