# -*- coding: utf-8 -*-

import codecs
import socket
import struct
import sys
import datetime
import glob
import csv
import re
import os
import os.path
import proto

if sys.version_info[0] != 3:
    print('This program requires Python 3')
    sys.exit(1)

SUPPORTED_PROTOCOLS = [2, 4]

UDP_IP = "127.0.0.1"
UDP_PORT = 12000
UDP_SEND_PORT = 11000


class Vector3f(object):
    def __init__(self):
        self.x = 0
        self.y = 0
        self.z = 0

    def __str__(self):
        return '[%f, %f, %f]' % (self.x, self.y, self.z)


class BinaryReader(object):
    def __init__(self, data):
        self.data = data
        self.offset = 0

    def read_byte(self):
        fmt = 'B'
        r = struct.unpack_from(fmt, self.data, self.offset)[0]
        self.offset += struct.calcsize(fmt)
        return r

    def read_bytes(self, length):
        fmt = '%dB' % length
        r = struct.unpack_from(fmt, self.data, self.offset)
        self.offset += struct.calcsize(fmt)
        return r

    def read_int32(self):
        fmt = 'i'
        r = struct.unpack_from(fmt, self.data, self.offset)[0]
        self.offset += struct.calcsize(fmt)
        return r

    def read_single(self):
        fmt = 'f'
        r = struct.unpack_from(fmt, self.data, self.offset)[0]
        self.offset += struct.calcsize(fmt)
        return r

    def read_string(self):
        length = self.read_byte()
        bytes_str = self.read_bytes(length)
        return ''.join([chr(x) for x in bytes_str])

    def read_uint16(self):
        fmt = 'H'
        r = struct.unpack_from(fmt, self.data, self.offset)[0]
        self.offset += struct.calcsize(fmt)
        return r

    def read_uint32(self):
        fmt = 'I'
        r = struct.unpack_from(fmt, self.data, self.offset)[0]
        self.offset += struct.calcsize(fmt)
        return r

    def read_utf_string(self):
        length = self.read_byte()
        bytes_str = self.read_bytes(length * 4)

        return bytes(bytes_str).decode('utf-32')

    def read_vector_3f(self):
        v = Vector3f()
        v.x = self.read_single()
        v.y = self.read_single()
        v.z = self.read_single()

        return v


class BinaryWriter(object):
    def __init__(self):
        self.buff = b''

    def write_byte(self, data):
        self.buff += struct.pack('B', data)

    def write_bytes(self, data, length):
        self.buff += struct.pack('%dB' % length, *data)

    def write_uint16(self, data):
        self.buff += struct.pack('H', data)

    def write_utf_string(self, data):
        self.write_byte(len(data))

        bytes_str = data.encode('utf-32')
        if bytes_str.startswith(codecs.BOM_UTF32):
            # Remove the BOM
            bytes_str = bytes_str[len(codecs.BOM_UTF32):]
        self.write_bytes(bytes_str, len(bytes_str))

class CarLapExtractor:
    id = 0
    reNonAlpha = re.compile(r"[^a-zA-Z]")

    def __init__(self, car_id):
        self.car_id = car_id
        self.frames = []
        
    def handleCarUpdate(self, carUpdate):
        self.frames.append(carUpdate)
    
    def __format_laptime(self, ms):
        td = datetime.timedelta(milliseconds=ms)
        return "{:02}.{:02}.{:03}".format(td.seconds // 60, td.seconds % 60, td.microseconds // 1000)
        
    def __create_lap_filepath(self, carLapCompleted, carInfo, sessionInfo):
        folderpath = "laps/"
        if sessionInfo:
            folderpath += "{}_{}_airt={}_roadt={}/".format(sessionInfo["track"], sessionInfo["track_config"], sessionInfo["ambient_temp"], sessionInfo["road_temp"])
        
        if carInfo:
            folderpath += carInfo["car_model"] + "/"
        
        if not os.path.isdir(folderpath):
            os.makedirs(folderpath)
        
        filename = self.__format_laptime(carLapCompleted["laptime"]) + "_"
        
        if carInfo:
            filename += CarLapExtractor.reNonAlpha.sub(carInfo["driver_name"], "_")
        else:
            filename += "{:02}".format(self.car_id)
        
        i = 1
        suffix = ''
        while os.path.isfile(folderpath + filename + suffix + ".csv"):
            i += 1
            suffix = "{:03}".format(i)
        
        return folderpath + filename + suffix + ".csv"
        
    def closeLap(self, carLapCompleted, carInfo, sessionInfo):
        CarLapExtractor.id += 1
        
        filename = self.__create_lap_filepath(carLapCompleted, carInfo, sessionInfo)
        with open(filename, "w", newline="") as f:
            csvwriter = csv.writer(f, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
            csvwriter.writerow(list(self.frames[0].keys()))
            for frame in self.frames:
                csvwriter.writerow(list(frame.values()))
                
            f.close()

class LapExtractor(object):
    def __init__(self):
        self.br = None
        self.sessionInfo = None
        self.carsInfo = {}
        self.carsLapExtractor = {}

    def _check_protocol(self, protocol_version):
        '''
        Checks that the given procotol version is supported,
        the program will quit otherwise
        '''
        if protocol_version not in SUPPORTED_PROTOCOLS:
            print('Unsupported protocol version: %d, expecting: %s' %
                  (protocol_version, SUPPORTED_PROTOCOLS))
            sys.exit(1)

    def _send(self, buff):
        '''
        Send buffer to server
        '''
        self.sock.sendto(buff, (UDP_IP, UDP_SEND_PORT))

    # The methods below are to handle data received from the server

    def _handle_car_info(self):
        car_id = self.br.read_byte()
        is_connected = self.br.read_byte() != 0
        car_model = self.br.read_utf_string()
        car_skin = self.br.read_utf_string()
        driver_name = self.br.read_utf_string()
        driver_team = self.br.read_utf_string()
        driver_guid = self.br.read_utf_string()

        print('====')
        print('Car info: %d %s (%s), Driver: %s, Team: %s, GUID: %s, Connected: %s' %
              (car_id, car_model, car_skin, driver_name, driver_team, driver_guid, is_connected))
        # TODO: implement example testSetSessionInfo()

    def _handle_car_update(self):
        car_id = self.br.read_byte()
        pos = self.br.read_vector_3f()
        velocity = self.br.read_vector_3f()
        gear = self.br.read_byte()
        engine_rpm = self.br.read_uint16()
        normalized_spline_pos = self.br.read_single()
        
        carUpdate = {
            "car_id": car_id,
            "pos_x": pos.x,
            "pos_y": pos.y,
            "pos_z": pos.z,
            "velocity_x": velocity.x,
            "velocity_y": velocity.y,
            "velocity_z": velocity.z,
            "gear": gear,
            "engine_rpm": engine_rpm,
            "normalized_spline_pos": normalized_spline_pos
        }
        
        if car_id not in self.carsLapExtractor:
            self.carsLapExtractor[car_id] = CarLapExtractor(car_id)
        
        self.carsLapExtractor[car_id].handleCarUpdate(carUpdate)
        
        #if not self.lapfileByCar[car_id]:
        #    filename = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S') + str(car_id) + ".csv"
        #    self.lapfileByCar[car_id] = open("laps/" + filename, "w")
        
        #self.lapfileByCar[car_id].write("{},{},{},{},{},{},
        
        
        print('====')
        print('Car update: %d, Position: %s, Velocity: %s, Gear: %d, RPM: %d, NSP: %f' %
              (car_id, pos, velocity, gear, engine_rpm, normalized_spline_pos))

    def _handle_chat(self):
        car_id = self.br.read_byte()
        msg = self.br.read_utf_string()
        print('====')
        print('Chat from car %d: "%s"' % (car_id, msg))

    def _handle_client_event(self):
        event_type = self.br.read_byte()
        car_id = self.br.read_byte()
        other_car_id = 255

        if event_type == proto.ACSP_CE_COLLISION_WITH_CAR:
            other_car_id = self.br.read_byte()
        elif event_type == proto.ACSP_CE_COLLISION_WITH_ENV:
            pass

        impact_speed = self.br.read_single()
        world_pos = self.br.read_vector_3f()
        rel_pos = self.br.read_vector_3f()

        print('====')
        if event_type == proto.ACSP_CE_COLLISION_WITH_CAR:
            print('Collision with car, car: %d, other car: %d, Impact speed: %f, World position: %s, Relative position: %s' %
                  (car_id, other_car_id, impact_speed, world_pos, rel_pos))
        elif event_type == proto.ACSP_CE_COLLISION_WITH_ENV:
            print('Collision with environment, car: %d, Impact speed: %f, World position: %s, Relative position: %s' %
                  (car_id, impact_speed, world_pos, rel_pos))

    def _handle_client_loaded(self):
        car_id = self.br.read_byte()
        print('====')
        print('Client loaded: %d' % car_id)

    def _handle_connection_closed(self):
        driver_name = self.br.read_utf_string()
        driver_guid = self.br.read_utf_string()
        car_id = self.br.read_byte()
        car_model = self.br.read_string()
        car_skin = self.br.read_string()

        print('====')
        print('Connection closed')
        print('Driver: %s, GUID: %s' % (driver_name, driver_guid))
        print('Car: %d, Model: %s, Skin: %s' % (car_id, car_model, car_skin))

    def _handle_end_session(self):
        filename = self.br.read_utf_string()
        print('====')
        print('Report JSON available at: %s' % filename)

    def _handle_error(self):
        print('====')
        print('ERROR: %s' % self.br.read_utf_string())

    def _handle_lap_completed(self):
        car_id = self.br.read_byte()
        laptime = self.br.read_uint32()
        cuts = self.br.read_byte()

        print('====')
        print('Lap completed')
        print('Car: %d, Laptime: %d, Cuts: %d' % (car_id, laptime, cuts))

        carLapCompleted = {
            "car_id": car_id,
            "laptime": laptime,
            "cuts": cuts
        }
        
        if car_id in self.carsLapExtractor:
            carInfo = None
            if car_id in self.carsInfo:
                carInfo = self.carsInfo[car_id]
            
            self.carsLapExtractor[car_id].closeLap(carLapCompleted, carInfo, self.sessionInfo)
            del self.carsLapExtractor[car_id]
        
        # cars_count = self.br.read_byte()

        # for i in range(1, cars_count + 1):
            # rcar_id = self.br.read_byte()
            # rtime = self.br.read_uint32()
            # rlaps = self.br.read_byte()
            # print('%d: Car ID: %d, Time: %d, Laps: %d' %
                  # (i, rcar_id, rtime, rlaps))

        # grip_level = self.br.read_byte()
        # print('Grip level: %d' % grip_level)

    def _handle_new_connection(self):
        driver_name = self.br.read_utf_string()
        driver_guid = self.br.read_utf_string()
        car_id = self.br.read_byte()
        car_model = self.br.read_string()
        car_skin = self.br.read_string()
        
        carInfo = {
            "driver_name": driver_name,
            "driver_guid": driver_guid,
            "car_id": car_id,
            "car_model": car_model,
            "car_skin": car_skin
        }
        
        self.carsInfo[car_id] = carInfo

        print('====')
        print('New connection')
        print('Driver: %s, GUID: %s' % (driver_name, driver_guid))
        print('Car: %d, Model: %s, Skin: %s' % (car_id, car_model, car_skin))

    def _handle_new_session(self):
        print('====')
        print('New session started')

    def _handle_session_info(self):
        protocol_version = self.br.read_byte()
        session_index = self.br.read_byte()
        current_session_index = self.br.read_byte()
        session_count = self.br.read_byte()
        server_name = self.br.read_utf_string()
        track = self.br.read_string()
        track_config = self.br.read_string()
        name = self.br.read_string()
        typ = self.br.read_byte()
        time = self.br.read_uint16()
        laps = self.br.read_uint16()
        wait_time = self.br.read_uint16()
        ambient_temp = self.br.read_byte()
        road_temp = self.br.read_byte()
        weather_graphics = self.br.read_string()
        elapsed_ms = self.br.read_int32()
        
        self.sessionInfo = {
            "track": track,
            "track_config": track_config,
            "ambient_temp": ambient_temp,
            "road_temp": road_temp
        }

        self._check_protocol(protocol_version)

        print('====')
        print('Session Info')
        print('Protocol version: %d' % protocol_version)
        print('Session index: %d/%d, Current session: %d' %
              (session_index, session_count, current_session_index))
        print('Server name: %s' % server_name)
        print('Track: %s (%s)' % (track, track_config))
        print('Name: %s' % name)
        print('Type: %d' % typ)
        print('Time: %d' % time)
        print('Laps: %d' % laps)
        print('Wait time: %d' % wait_time)
        print('Weather: %s, Ambient temp: %d, Road temp: %d' %
              (weather_graphics, ambient_temp, road_temp))
        print('Elapsed ms: %d' % elapsed_ms)

    def _handle_version(self):
        protocol_version = self.br.read_byte()
        self._check_protocol(protocol_version)
        print('====')
        print('Protocol version: %d' % protocol_version)

    # The methods below are to send data to the server

    def _admin_command(self, command):
        '''
        Send admin command
        '''
        bw = BinaryWriter()

        bw.write_byte(proto.ACSP_ADMIN_COMMAND)
        bw.write_utf_string(command)

        self._send(bw.buff)

    def _broadcast_chat(self, message):
        '''
        Broadcast message to all cars
        '''
        bw = BinaryWriter()

        bw.write_byte(proto.ACSP_BROADCAST_CHAT)
        bw.write_utf_string(message)

        self._send(bw.buff)

    def _get_car_info(self, car_id):
        '''
        Requests car info for car_id
        '''
        bw = BinaryWriter()

        bw.write_byte(proto.ACSP_GET_CAR_INFO)
        bw.write_byte(car_id)

        self._send(bw.buff)

    def _enable_realtime_report(self):
        bw = BinaryWriter()
        bw.write_byte(proto.ACSP_REALTIMEPOS_INTERVAL)
        bw.write_uint16(100)  # Interval in ms (1Hz)

        self._send(bw.buff)

    def _kick(self, car_id):
        bw = BinaryWriter()
        bw.write_byte(proto.ACSP_KICK_USER)
        bw.write_byte(car_id)

        self._send(bw.buff)

    def _next_session(self):
        bw = BinaryWriter()
        bw.write_byte(proto.ACSP_NEXT_SESSION)

        self._send(bw.buff)

    def _restart_session(self):
        bw = BinaryWriter()
        bw.write_byte(proto.ACSP_RESTART_SESSION)

        self._send(bw.buff)

    def _send_chat(self, car_id, message):
        '''
        Send message to specific car
        '''
        bw = BinaryWriter()

        bw.write_byte(proto.ACSP_SEND_CHAT)
        bw.write_byte(car_id)
        bw.write_utf_string(message)

        self._send(bw.buff)

    def run(self, files):
        self.carsLapExtractor = {}
        self.carsInfo = {}
        for file in files:
            with open(file, 'rb') as logfile:
                
                while True:
                    sdata = logfile.read(1024)
                    if len(sdata) == 0:
                        break
                        
                    self.br = BinaryReader(sdata)
                    packet_id = self.br.read_byte()
                    
                    if packet_id == proto.ACSP_ERROR:
                        self._handle_error()
                    elif packet_id == proto.ACSP_CHAT:
                        self._handle_chat()
                    elif packet_id == proto.ACSP_CLIENT_LOADED:
                        self._handle_client_loaded()
                    elif packet_id == proto.ACSP_VERSION:
                        self._handle_version()
                    elif packet_id == proto.ACSP_NEW_SESSION:
                        self._handle_new_session()
                        self._handle_session_info()

                        # Uncomment to enable realtime position reports
                        #self._enable_realtime_report()
                    elif packet_id == proto.ACSP_SESSION_INFO:
                        self._handle_session_info()
                    elif packet_id == proto.ACSP_END_SESSION:
                        self._handle_end_session()
                    elif packet_id == proto.ACSP_CLIENT_EVENT:
                        self._handle_client_event()
                    elif packet_id == proto.ACSP_CAR_INFO:
                        self._handle_car_info()
                    elif packet_id == proto.ACSP_CAR_UPDATE:
                        self._handle_car_update()
                    elif packet_id == proto.ACSP_NEW_CONNECTION:
                        self._handle_new_connection()
                    elif packet_id == proto.ACSP_CONNECTION_CLOSED:
                        self._handle_connection_closed()
                    elif packet_id == proto.ACSP_LAP_COMPLETED:
                        self._handle_lap_completed()
                    #else:
                    #    print('** UNKOWNN PACKET ID: %d' % packet_id)

if __name__ == '__main__':
    p = LapExtractor()
    files = glob.glob(sys.argv[1])
    p.run(files)
