//Physics Engine Variables
var myengine;
var myworld;
var mymouseconstraint;
var mymouse;
var mytimescale = 1;

//Bodies
var boxes = [];
var spheres = [];
var boundaries = [];
var Nbodies = 1;

//Canvas Properties
var mycanvas2;
//var mywidth = 1366;
//var myheight = 657;
var wallthickness = 150;
let mywidth = $("#jscode2").parent().width();
let myheight = 200;

function setup() {
    mycanvas2 = createCanvas(mywidth, myheight);
	mycanvas2.parent("jscode2");
	//Create Engine and World
    myengine = Matter.Engine.create();
	myengine.timing.timeScale=mytimescale;
	Matter.Engine.run(myengine); //Run the Engine (otherwise update in draw)
    myworld = myengine.world;
    //myworld.gravity.y = 0;
	myworld.bounds = { min: { x: 0, y: 0 }, max: { x: mywidth, y: myheight } }
	
	
	
	//Interaction with Mouse
	mymouse = Matter.Mouse.create(mycanvas2.elt);
	mymouse.pixelRatio = pixelDensity();
	mymouseconstraint = Matter.MouseConstraint.create(myengine, {mouse: mymouse})
	Matter.World.add(myworld, mymouseconstraint);
	
	
    //Setup Objects
	//boundaries.push(new StaticBoundary(0,myheight/2,wallthickness,myheight,0));
	//boundaries.push(new StaticBoundary(mywidth,myheight/2,wallthickness,myheight,0));
	//boundaries.push(new StaticBoundary(mywidth/2,0,wallthickness,mywidth,PI/2));
	//boundaries.push(new StaticBoundary(mywidth/2,myheight,wallthickness,mywidth,PI/2));
	
	//boxes.push(new SolidBox(mywidth-200,myheight/2,300,myheight));
	boundaries.push(new StaticBoundary(mywidth*0.22, myheight*0.7, mywidth*0.55, 50, 0.3));
	boundaries.push(new StaticBoundary(mywidth*0.78, myheight*0.7, mywidth*0.55, 50, -0.3));
//	for (var i = 0; i < Nparticles; i++){
//		balls.push(new SolidBall(random(wallthickness/2,mywidth), random(wallthickness,myheight-wallthickness),20));
//	}
	
}


//function mouseDragged() {
//    boxes.push(new SolidBox(mouseX, mouseY, random(10, 40), random(10, 40)));
//}


//function mousePressed() {
//    boxes.push(new SolidBox(mouseX, mouseY, 10, 10));
//}

var idraw = 0;

function draw() { 
	idraw++;
	background(20);
	//Matter.Engine.update(myengine);
	
	
	//Ball Fountain
	if (idraw<50){
	spheres.push(new SolidBall(mywidth*0.55, myheight*0.1, random(10,5)));
	spheres.push(new SolidBall(mywidth*0.45, myheight*0.1, random(10,5)));
	}
	
	//Draw the Bodies
    for (var i = 0; i < boxes.length; i++) {
        boxes[i].show();
    }
	for (var i = 0; i < spheres.length; i++) {
        spheres[i].show();
		if (spheres[i].isOffScreen()){
			spheres[i].removeFromWorld();
			spheres.splice(i,1);
			i--;
		}
    }
	for (var i = 0; i < boundaries.length; i++) {
        boundaries[i].show();
    }
}

