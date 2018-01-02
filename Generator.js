var fs = require('fs');
var mysql = require('mysql');
var _ = require('underscore')
var cbCount = 0;

var days = 8;
var capacityPerSlot = 1500;
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

var totalBranches = [];
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
    this.setColor = function(color){
       this.color = color;
       this.color.filled += this.count;
       var sub = this;
       this.branches.forEach(function(branch){
           branch.setSlot(sub.color.slot);
       });
    }
}

function Branch(name){
    this.name = name;
    this.setSlot = function(slot){
        this.slot = slot;
    }
}

// function Color(code,day,slot,capacity){
//     this.code = code;
//     this.day = day;
//     this.slot = slot;
//     this.capacity = capacity;
//     this.filled = 0;
//     this.subjects = [];
//     this.subjectDomain = [];
//     this.updateDomain = function(coloredSub){
        
//     }

    
    
// }

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
        sql = "INSERT IGNORE INTO Colors (Code,Day,Slot,Capacity,Filled) VALUES('D"+day+"S"+slot+"',"+day+","+slot+","+capacityPerSlot+",0)";
        colors.push({code:"D"+day+"S"+slot,day:day,slot:slot,capacity:capacityPerSlot,filled:0});
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
                    var selectedBranch = _.find(totalBranches,function(branch){
                        return branch.name == br.Branch;
                    });
                    if(selectedBranch){
                        obj.branches.push(selectedBranch)
                    }
                    else{
                        selectedBranch = new Branch(br.Branch)
                        totalBranches.push(selectedBranch);
                        obj.branches.push(selectedBranch);
                    }
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
        if(!subject.color){
            var possibleColors = _.filter(colors,function(color){
                var remaining = color.capacity - color.filled;
                var flag = true;
                for(var i=0;i<subject.branches.length;i++){
                    if(subject.branches[i].slot && subject.branches[i].slot != color.slot){
                        flag = false;
                        break;
                    }
                }

                return remaining >= subject.count && flag
            });

            if(possibleColors.length > 0){
                subject.setColor(possibleColors[0]);
                subject.adjSub.forEach(function(sub){
                    if(!sub.sub.color){
                        var remaining = subject.color.capacity - subject.color.filled;
                        if(remaining >= sub.sub.count){
                            sub.sub.setColor(subject.color);
                        }
                    }
                });
            }
            else{
                console.log("No color available for  "+subject.code);
                process.exit(0);
            }
        }
   });
   _.each(totalSubs,function(subject){
        console.log(subject.code + "-" + subject.color.code);
   });
}

//Main function
create_colors();
Graph();










