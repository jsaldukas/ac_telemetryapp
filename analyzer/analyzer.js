var LapAnalysisCanvas = function (options) {
	if(!options) throw 'LapAnalysisCanvas: op1tions parameter must be specified';
	if(!options.canvas) throw 'LapAnalysisCanvas: options.canvas parameter must be specified';
	if(!options.laps) throw 'LapAnalysisCanvas: options.laps parameter must be specified';
	if(!options.laps.length) throw 'LapAnalysisCanvas: options.laps must be an array of lap data';
	if(!options.laps[0].length) throw 'LapAnalysisCanvas: options.laps must be an array of lap data';
	
	var canvas = $(options.canvas)[0];
	if(!canvas) throw 'LapAnalysisCanvas: canvas not found';
	
	var totalLapsExtent = calculateLapsExtent(options.laps);
	
	var instance = {
		options,
		canvas,
		animateContext: null,
		coordinateTransformer: buildCoordinateTransformer(totalLapsExtent, canvas.width, canvas.height, 10),
		canvasScale: 1,
		canvasOffsetX: 0,
		canvasOffsetY: 0
	};
	
	var dragStartMousePos = 0;
	var dragStartCanvasOffset = 0;
	$(canvas).on('mousedown', function (event) {
		if(event.button == 0) {
			dragStartMousePos = [event.pageX, event.pageY];
			dragStartCanvasOffset = [instance.canvasOffsetX, instance.canvasOffsetY];
		}
	});
	$(canvas).on('mouseup', function (event) {
		if(event.button == 0) {
			dragStartMousePos = 0;
			dragStartCanvasOffset = 0;
		}
	});
	$(canvas).on('mousemove', function (event) {
		if(dragStartCanvasOffset && dragStartMousePos) {
			var mult = 1;
			
			instance.canvasOffsetX = dragStartCanvasOffset[0] + event.pageX - dragStartMousePos[0];
			instance.canvasOffsetY = dragStartCanvasOffset[1] + event.pageY - dragStartMousePos[1];
			
			console.log(JSON.stringify(event));
			console.log(JSON.stringify(event.originalEvent));
		}
	});
	
	
	$(canvas).on('mousewheel', function (event, b, c, d, e) {
		var wheelDelta;
		if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
			// scroll up
			wheelDelta = 1;
		}
		else {
			// scroll down
			wheelDelta = -1;
		}
		
		//console.log('wheel event' + JSON.stringify(event));
		var scale = instance.canvasScale;
		scale += wheelDelta * 0.1;
		
		if(scale <= 0) scale = 0.1;
		if(scale > 15) scale = 15;
		console.log('scale ' + scale);
		instance.canvasScale = scale;
	});
	
	//var coordTransform = getLapToCanvasCoordTransform([lapData1, lapData2], width, height);
	
	//lapsContext.coordTransform = coordTransform;
	//var canvasWidth = width;
	//var canvasHeight = height;
	//var canvasMinDimension = width > height ? height : width;
	//lapsContext.canvas = myCanvas;
	
	//console.log('laps loaded');

	//startLapAnimation();
	
	function buildCoordinateTransformer(totalLapsExtent, canvasWidth, canvasHeight, canvasPadding) {
		var trackDimensionX = (totalLapsExtent.maxX - totalLapsExtent.minX);
		var trackDimensionZ = (totalLapsExtent.maxZ - totalLapsExtent.minZ);
		
		var canvasMinDimension = (canvasWidth > canvasHeight ? canvasHeight : canvasWidth) - canvasPadding * 2;
		var trackMaxDimension = trackDimensionX < trackDimensionZ ? trackDimensionZ : trackDimensionX;
		
		var scale = canvasMinDimension / trackMaxDimension;
		
		var centerPosX = trackDimensionX / 2 + totalLapsExtent.minX;
		var centerPosZ = trackDimensionZ / 2 + totalLapsExtent.minZ;
		
		// var minScale = 999999;
		// var minOffsetX = 999999;
		// var minOffsetZ = 999999;
		// var canvasSize = canvasHeight > canvasWidth ? canvasWidth : canvasHeight;
		// for(var i = 0; i < lapDataList.length; i++) {
			// var lapData = lapDataList[i];
			// var lapRect = calculateLapRect(lapData);
			// var scaleX = canvasSize / (lapRect.maxX - lapRect.minX);
			// var scaleZ = canvasSize / (lapRect.maxZ - lapRect.minZ);
			// var scale = scaleX > scaleZ ? scaleZ : scaleX;
			// var offsetX = -lapRect.minX;
			// var offsetZ = -lapRect.minZ;
			
			// if(scale < minScale) minScale = scale;
			// if(offsetX < minOffsetX) minOffsetX = offsetX;
			// if(offsetZ < minOffsetZ) minOffsetZ = offsetZ;
		// }
		
		// return {
			// scale: minScale,
			// offsetX: minOffsetX,
			// offsetZ: minOffsetZ
		// };
		
		console.log(JSON.stringify(totalLapsExtent));
		console.log('w' + canvasWidth + ', h' + canvasHeight);
		console.log('center ' + centerPosX + '; ' + centerPosZ);
		return {
			getx: function (lap_pos_x) {
				return (lap_pos_x - centerPosX) * scale + canvasWidth  / 2;
			},
			gety: function (lap_pos_z) {
				return (lap_pos_z - centerPosZ) * scale + canvasHeight / 2;
			}
		};
	}
	
	function calculateLapsExtent(laps) {
		var minX = 999999, maxX = -999999, minZ = 999999, maxZ = -999999;
		for(var lapIndex = 0; lapIndex < laps.length; lapIndex++) {
			var lapData = laps[lapIndex];
			for(var i = 0; i < lapData.length; i++) {
				var lapFrame = lapData[i];
				if(lapFrame.pos_x < minX) minX = lapFrame.pos_x;
				if(lapFrame.pos_x > maxX) maxX = lapFrame.pos_x;
				if(lapFrame.pos_z < minZ) minZ = lapFrame.pos_z;
				if(lapFrame.pos_z > maxZ) maxZ = lapFrame.pos_z;
			}
		}
		
		return {
			minX: minX,
			maxZ: maxZ,
			maxX: maxX,
			minZ: minZ
		};
	}
	
	function drawLapPointers(ctx, lapFrame, nextFrame, interpCoeff, color) {
		ctx.save();
		
		ctx.beginPath();
		
		var canvasX = instance.coordinateTransformer.getx(lapFrame.pos_x);
		var canvasY = instance.coordinateTransformer.gety(lapFrame.pos_z);
		
		if(interpCoeff && nextFrame) {
			var nextCanvasX = instance.coordinateTransformer.getx(nextFrame.pos_x);
			var nextCanvasY = instance.coordinateTransformer.gety(nextFrame.pos_z);
			
			canvasX += (nextCanvasX - canvasX) * interpCoeff;
			canvasY += (nextCanvasY - canvasY) * interpCoeff;
		}
			
		ctx.arc(canvasX, canvasY, 10, 0, 2*Math.PI);
		ctx.fillStyle = color;
		ctx.fill();
		
		ctx.restore();
	}

	function drawLap(ctx, lapData, color) {
		ctx.save();
		ctx.beginPath();
		
		if(color) {
			ctx.strokeStyle = color;
		}
		
		ctx.lineWidth = 1;
		
		var canvasX = instance.coordinateTransformer.getx(lapData[0].pos_x);
		var canvasY = instance.coordinateTransformer.gety(lapData[0].pos_z);
			
		ctx.moveTo(canvasX, canvasY);
		
		for(var i = 0; i < lapData.length; i++) {
			canvasX = instance.coordinateTransformer.getx(lapData[i].pos_x);
			canvasY = instance.coordinateTransformer.gety(lapData[i].pos_z);
			// var canvasX = getCanvasX(lapData[i].pos_x, coordTransform);
			// var canvasY = getCanvasY(lapData[i].pos_z, coordTransform);
			ctx.lineTo(canvasX, canvasY);
		}
		
		ctx.closePath();
		ctx.stroke();
		
		ctx.restore();
	}

	function drawLaps(ctx) {
		var colors = ['grey', 'red', 'green'];
		// var coordTransform = lapsContext.coordTransform;
		var laps = instance.options.laps;
		
		for(var i = 0; i < laps.length; i++) {
			var color = colors[i % colors.length];
			drawLap(ctx, laps[i], color);
			
			if(instance.animateContext && instance.animateContext.laps[i]) {
				var animateContextLap = instance.animateContext.laps[i];
				var currentLapFrame =  animateContextLap.frames[animateContextLap.framePointer];
				drawLapPointers(ctx, currentLapFrame, animateContextLap.nextFrame, animateContextLap.interpCoeff, color);
			}
		}
	}
	
	// function drawLaps() {
		// var canvas = instance.canvas;
		// var ctx = canvas.getContext('2d');
		// ctx.clearRect(0, 0, canvas.width, canvas.height);
		// drawLaps(ctx);
	// }
	
	function startLapAnimation() {
		instance.animateContext = {};
		instance.animateContext.currentTimeMs = 0;
		// instance.animateContext.lapsFramePointers = [];
		instance.animateContext.startTimeMs = getTime();
		// instance.animateContext.isLapFinished = [];
		// instance.animateContext.lapsTimeOffset = [];
		instance.animateContext.laps = [];
		
		var laps = instance.options.laps;
		laps.forEach(function (lap) { 
			// instance.animateContext.lapsFramePointers.push(0); 
			// instance.animateContext.isLapFinished.push(false);
			// instance.animateContext.lapsTimeOffset.push(lap[0].time_ms);
			instance.animateContext.laps.push({
				framePointer: 0,
				isLapFinished: false,
				timeOffset: lap[0].time_ms,
				interpNextFrame: lap[1],
				frames: lap,
				interpCoeff: 0
			});
		});
		
		function frame() {
			var canvas = instance.canvas;
			var ctx = canvas.getContext('2d');
			ctx.save();
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.translate(instance.canvasOffsetX, instance.canvasOffsetY);
			ctx.scale(instance.canvasScale, instance.canvasScale);
			updateLapAnimation();
			drawLaps(ctx);
			
			ctx.restore();
			
			instance.animateContext.requestAnimationFrame = window.requestAnimationFrame(frame);
		}
		
		instance.animateContext.requestAnimationFrame = window.requestAnimationFrame(frame);
		console.log('animation started');
	}

	function endLapAnimation() {
		window.cancelAnimationFrame(instance.animateContext.requestAnimationFrame);
		console.log('animation ended');
	}

	function updateLapAnimation(time) {
		var laps = instance.options.laps;
		var currentTimeMs = getTime() - instance.animateContext.startTimeMs;
		instance.animateContext.currentTimeMs = currentTimeMs;
		
		$('#textC').text(currentTimeMs);
		
		for(var lapIndex = 0; lapIndex < laps.length; lapIndex++) {
			var animateContextLap = instance.animateContext.laps[lapIndex];
			
			if(animateContextLap.isLapFinished)
				continue;
			
			var timeOffset = animateContextLap.timeOffset;
			var framePtr = animateContextLap.framePointer;
			while(animateContextLap.frames[framePtr].time_ms - timeOffset < instance.animateContext.currentTimeMs) {
				framePtr++;
				if(framePtr >= animateContextLap.frames.length) {
					animateContextLap.isLapFinished = true;
					framePtr--;
					break;
				}
			}
			
			var lapFrame = animateContextLap.frames[framePtr];
			var debugElemSelector = lapIndex == 0 ? '#textA' : '#textB';
			$(debugElemSelector).text("Time: " + lapFrame.time_ms);
			
			animateContextLap.framePointer = framePtr;
			
			var nextFramePtr = framePtr + 1;
			if(nextFramePtr < animateContextLap.frames.length) {
				var nextFrame = animateContextLap.frames[nextFramePtr];
				animateContextLap.nextFrame = nextFrame;
				animateContextLap.interpCoeff = (currentTimeMs - lapFrame.time_ms) / (nextFrame.time_ms - lapFrame.time_ms);
			} else {
				animateContextLap.interpCoeff = 0;
			}
			
		}
		
		// if all laps finished then reset
		if(!instance.animateContext.laps.some(function (lap) { return !lap.isLapFinished; })) {
			endLapAnimation();
			startLapAnimation();
			console.log('animation restarted');
		}
	}

	// function getLapToCanvasCoordTransform(lapDataList, canvasWidth, canvasHeight) {
		// var minScale = 999999;
		// var minOffsetX = 999999;
		// var minOffsetZ = 999999;
		// var canvasSize = canvasHeight > canvasWidth ? canvasWidth : canvasHeight;
		// for(var i = 0; i < lapDataList.length; i++) {
			// var lapData = lapDataList[i];
			// var lapRect = calculateLapRect(lapData);
			// var scaleX = canvasSize / (lapRect.maxX - lapRect.minX);
			// var scaleZ = canvasSize / (lapRect.maxZ - lapRect.minZ);
			// var scale = scaleX > scaleZ ? scaleZ : scaleX;
			// var offsetX = -lapRect.minX;
			// var offsetZ = -lapRect.minZ;
			
			// if(scale < minScale) minScale = scale;
			// if(offsetX < minOffsetX) minOffsetX = offsetX;
			// if(offsetZ < minOffsetZ) minOffsetZ = offsetZ;
		// }
		
		// return {
			// scale: minScale,
			// offsetX: minOffsetX,
			// offsetZ: minOffsetZ
		// };
	// }
	
	function draw() {
		var canvas = instance.canvas;
		var ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		drawLaps(ctx);
	}
	
	return {
		draw: draw,
		startLapAnimation: startLapAnimation,
		endLapAnimation: endLapAnimation
	};
};

var LapLoader = function () {
	
	function loadLapData(url) {
		// time_ms,car_id,pos_x,pos_y,pos_z,velocity_x,velocity_y,velocity_z,gear,engine_rpm,normalized_spline_pos
		return $.ajax({
			url: url,
			method: 'GET'
		}).then(function (data) {
			var rows = data.split("\r\n");
			var lapFrames = [];
			var header = rows[0].split(',');
			for(var i = 1; i < rows.length; i++) {
				var cols = rows[i].split(',');
				if(cols.length <= 1)
					continue;
				var lapFrame = {};
				for(var j = 0; j < cols.length; j++) {
					var value = cols[j];
					var floatValue = parseFloat(value);
					if(!isNaN(floatValue))
						value = floatValue;
					lapFrame[header[j]] = value;
				}
				lapFrames.push(lapFrame);
			}
			
			normalizeFieldNames(lapFrames);
			adjustLapTime(lapFrames);
			
			return lapFrames;
		});
	}
	
	function normalizeFieldNames(lap) {
		lap.forEach(function (frame) { 
			if(frame.lapTimeMs) frame.time_ms = frame.lapTimeMs;
			if(frame.trackPosition) frame.normalized_spline_pos = frame.trackPosition;
		});
	}
	
	function adjustLapTime(lap) {
		var minTimeMs = lap[0].time_ms;
		lap.forEach(function (frame) { 
			frame.time_ms -= minTimeMs;
		});
	}

	
	return {
		load: loadLapData
	};
}

// function setLapCanvasCoordinates(lapData, canvasSize) {
	// var lapRect = calculateLapRect(lapData);
	// var scaleX = canvasSize / (lapRect.maxX - lapRect.minX);
	// var scaleZ = canvasSize / (lapRect.maxZ - lapRect.minZ);
	// var scale = scaleX > scaleZ ? scaleZ : scaleX;
	// var offsetX = -lapRect.minX;
	// var offsetZ = -lapRect.minZ;
	// for(var i = 0; i < lapData.length; i++) {
		// var lapFrame = lapData[i];
		// lapFrame.canvas_x = (lapFrame.pos_x + offsetX) * scale;
		// lapFrame.canvas_y = (lapFrame.pos_z + offsetZ) * scale;
	// }
// }


// var laps = [];
// var lapsContext = {};
// var lapsAnimateContext = {};

function loadLapComparison(lapUrl1, lapUrl2) {
	var lapLoader = LapLoader();
	var lapAnalysisCanvas = 0;
	lapLoader.load(lapUrl1).then(function (lapData1) {
		lapLoader.load(lapUrl2).then(function (lapData2) {
			lapAnalysisCanvas = LapAnalysisCanvas({
				canvas: '#myCanvas',
				laps: [lapData1, lapData2]
			});
			
			lapAnalysisCanvas.draw();
			lapAnalysisCanvas.startLapAnimation();
			// laps.push({
				// data: lapData1
			// });
			// laps.push({
				// data: lapData2
			// });
			
			
			
			// var myCanvas = $('#myCanvas')[0]; 
			// var width = myCanvas.width;
			// var height = myCanvas.height;
			// var coordTransform = getLapToCanvasCoordTransform([lapData1, lapData2], width, height);
			
			// lapsContext.coordTransform = coordTransform;
			// lapsContext.canvasWidth = width;
			// lapsContext.canvasHeight = height;
			// lapsContext.canvas = myCanvas;
			// console.log('laps loaded');
			
			//startLapAnimation();
			// window.requestAnimationFrame(function () {
				// var ctx = myCanvas.getContext('2d');
				// ctx.clearRect(0, 0, width, height);
				// drawLap(ctx, lapData1, coordTransform, 'grey');
				// drawLap(ctx, lapData2, coordTransform, 'red');
			// });
		});
	});
}



// function startLapAnimation() {
	// lapsAnimateContext = {};
	// lapsAnimateContext.currentTimeMs = 0;
	// lapsAnimateContext.lapsFramePointers = [];
	// lapsAnimateContext.startTimeMs = getTime();
	// lapsAnimateContext.isLapFinished = [];
	
	// laps.forEach(function () { 
		// lapsAnimateContext.lapsFramePointers.push(0); 
		// lapsAnimateContext.isLapFinished.push(false);
	// });
	
	// function frame() {
		// var ctx = lapsContext.canvas.getContext('2d');
		// ctx.clearRect(0, 0, lapsContext.canvasWidth, lapsContext.canvasHeight);
		// updateLapAnimation();
		// drawLaps(ctx);
		
		// lapsAnimateContext.requestAnimationFrame = window.requestAnimationFrame(frame);
	// }
	
	// lapsAnimateContext.requestAnimationFrame = window.requestAnimationFrame(frame);
	// console.log('animation started');
// }

// function endLapAnimation() {
	// window.cancelAnimationFrame(lapsAnimateContext.requestAnimationFrame);
	// console.log('animation ended');
// }

// function updateLapAnimation(time) {
	// var currentTimeMs = getTime() - lapsAnimateContext.startTimeMs;
	// lapsAnimateContext.currentTimeMs = currentTimeMs;
	
	// for(var lapIndex = 0; lapIndex < laps.length; lapIndex++) {
		// if(lapsAnimateContext.isLapFinished[lapIndex])
			// continue;
		
		// var framePtr = lapsAnimateContext.lapsFramePointers[lapIndex];
		// while(laps[lapIndex].data[framePtr].lap_time_ms < lapsAnimateContext.currentTimeMs) {
			// framePtr++;
			// if(framePtr >= laps[lapIndex].data.length) {
				// lapsAnimateContext.isLapFinished[lapIndex] = true;
				// framePtr--;
				// break;
			// }
		// }
		
		// lapsAnimateContext.lapsFramePointers[lapIndex] = framePtr;
	// }
	
	// // if all laps finished then reset
	// if(lapsAnimateContext.isLapFinished.indexOf(false) === -1) {
		// endLapAnimation();
		// startLapAnimation();
		// console.log('animation restarted');
	// }
// }


loadLapComparison('01.32.962_Justinas Saldukas_092769.csv', '01.32.127_Jurij Lapo_091938.csv');

// loadLapData('laps/01.29.538_18.csv').then(function (lapData) {
	// setLapCanvasCoordinates(lapData, 300, 300);
	// drawLap(lapData);
// });

// loadLapData('laps/01.29.538_18.csv').then(function (lapData) {
	// setLapCanvasCoordinates(lapData, 300, 300);
	// drawLap(lapData);
// });