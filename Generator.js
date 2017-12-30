var fs = require('fs');
var mysql = require('mysql');
var _ = require('underscore')
var cbCount = 0;

var days = 8;
var capacityPerSlot = 250;
var colors = [];

var con = mysql.createConnection({
    host: 'localhost',
    user: 'root',  //Replace username and password to your username and password
    password: 'mysql',
    database: 'amrita-registration'
});

con.connect(function(err){
    if(err) throw err;
    console.log('Connected to MYSQL!');
});


var totalSubs = [];
//Subject Constructor
function Subject(name,code,count,color){
    this.name = name;
    this.code = code;
    this.count = count;
    this.color = color;
    this.adjSub = [];
    this.branches = [];
    this.colorDomain = [];
    this.setColor = function(){
        if(this.colorDomain.length == 0){
            console.log("Unable to find color for the subject: "+this.code)
            process.exit(0);
        }
        var sub = this; //Due to wierd `this` behaviour in JS.
         sub.color = sub.colorDomain[0]; //_.find(sub.colorDomain,function(color){return color.capacity >= sub.count;}); //Take the color with lowest capacity
        sub.color.capacity = sub.color.capacity - sub.count;
        console.log(sub.color.capacity);
        // _.sortBy(sub.colorDomain,function(color){
        //     return -color.count;
        // }); 
    }
    this.updateDomain = function(coloredSub){ //Function to update the domain If coloredSub has been colored
        var sub = this;
       if(_.findWhere(coloredSub.adjSub,{sub:sub}) != undefined){ //If this subject is adjacent to the coloredSubject
            sub.colorDomain = _.filter(sub.colorDomain,function(color){ 
                return (color.day != coloredSub.color.day) && (color.slot == coloredSub.color.slot) && (color.capacity >= sub.count);
            });
        }
        else if(_.intersection(coloredSub.branches,sub.branches).length > 0){ //If the branch of the colored sub is there in this subject and it is not adjacent Eg:PHY,Chem
            sub.colorDomain = _.filter(sub.colorDomain,function(color){ 
                /*
                    Eg: If maths has been colored at D1S1 and it contains S1CSE students,
                    Then All the subjects which contain the S1CSE students can have exams at slot no 1 only for consistency but day can be sam
                */ 
                return (color.slot == coloredSub.color.slot) && (color.capacity >= sub.count);
            });
        }
        else{
            sub.colorDomain = _.filter(sub.colorDomain,function(color){ 
                return  (color.capacity >= sub.count);
            });
        }
        sub.colorDomain = _.sortBy(sub.colorDomain,function(color){return color.count;}); //Sort on asc order based on capacity To ensure that the colors are filled so we could have minimum days
    }
}
// Sort function same as compareTo function in Java.
function sort(a,b){
    if(a.count > b.count){
        return -1;
    }
    if(a.count < b.count){
        return 1;
    }
    return 0;
}

function sortOnDegree(a,b){
    if(a.adjSub.length > b.adjSub.length){
        return -1;
    }
    if(a.adjSub.length < b.adjSub.length){
        return 1;
    }
    if(a.adjSub.length == b.adjSub.length){
        var max1 = Math.max.apply(Math,a.adjSub.map(function(o){return o.count;}));
        var max2 = Math.max.apply(Math,b.adjSub.map(function(o){return o.count;}))
        if(max1 > max2){
            return -1;
        }
        else{
            return 1;
        }
        
    }
}

function returnSubObj(code){
    return _.find(totalSubs,function(obj){
        return obj.code == code;
    });
}

function create_colors(){
    for(i=1;i<=days*2;i++){
        day = (i%2 == 0)?parseInt(i/2):parseInt(i/2)+1;
        slot = (i%2 == 0)?2:1;
        sql = "INSERT IGNORE INTO Colors (Code,Day,Slot,Capacity) VALUES('D"+day+"S"+slot+"',"+day+","+slot+","+capacityPerSlot+")";
        colors.push({code:"D"+day+"S"+slot,day:day,slot:slot,capacity:capacityPerSlot});
        con.query(sql,function(err){
            if(err) throw err
        });
    }
    colors = _.sortBy(colors,function(color){return color.capacity});
}

function Graph(){
    var sql = "SELECT * FROM Courses WHERE 1";
    con.query(sql,function(err,result){
        if (err) throw err;
        console.log(colors);
        result.forEach(function(sub){
            sql = "SELECT DISTINCT Branch FROM "+sub.Code+" WHERE isArrear = 0"
            cbCount++;
            con.query(sql,function(err,branch){
                if(err) throw err;
                var obj = new Subject(sub.Name,sub.Code,sub.Students,sub.color);
                branch.forEach(function(br){
                    obj.branches.push(br.Branch);
                });
                obj.colorDomain = colors.slice();
                totalSubs.push(obj);
                cbCount--;
                if(cbCount==0){
                    console.log("subjects Created");
                    createGraph();
                }
            });
            
        });
        
    });
}

function createGraph(){
    var sql = "SELECT * FROM Matrix WHERE 1;"
    con.query(sql,function(err,result){
        if(err) throw err;
        result.forEach(function(subject){
            var sub1 = returnSubObj(subject.FromSUB);
            var sub2 = returnSubObj(subject.ToSUB);
            if(subject.Count > 0){
                sub1.adjSub.push({sub:sub2,count:subject.Count,arrears:subject.Arrears});
                sub2.adjSub.push({sub:sub1,count:subject.Count,arrears:subject.Arrears});
            }
        });
        totalSubs.sort(sortOnDegree);
        totalSubs.forEach(function(subject){
            subject.adjSub.sort(sort);
        });
        console.log("Graph Created!");
        generateTable();
    });
}

function generateTable(){
   _.each(totalSubs,function(subject){
        subject.setColor();
        var coloredSub = subject;
        _.each(totalSubs,function(sub){
            sub.updateDomain(coloredSub);
        });
   });
   console.log("done!");
}

//Main function
create_colors();
Graph();










