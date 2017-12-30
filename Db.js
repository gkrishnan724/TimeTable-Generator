var fs = require('fs');
var mysql = require('mysql');
var csv = require('fast-csv');
var cwd = 'Students_List'; //CSV FOLDER
var cbCount = 0; //Used to Check IF all Callbacks( Async process are finished)

var con = mysql.createConnection({
    host: 'localhost',
    user: 'root',  //Replace username and password to your username and password
    password: 'mysql',
    database: 'amrita-registration'
});

con.connect(function (err) {
    if (err) throw err;
    console.log('Connected to Mysql!');
    createStudentTable()
    // init()
    // findCommon()


    /*
        Code to Verify with Sandesh's Output.
        If Subjects are missing Error will be thrown in the query
    */
    // fs.readFile('name.txt','utf-8',function(err,contents){
    //     var subjects = contents.split('\n');
    //     subjects.forEach(function(sub){
    //         sub = sub.trim();
    //         let subcode;
    //         if(sub.indexOf('.') != -1){
    //             subcode = sub.substring(0,sub.indexOf('.'));
    //         }
    //         else if(sub.indexOf('/') != -1){
    //             subcode = sub.substring(0,Math.min(sub.indexOf(' '),sub.indexOf('/')));
    //         }
    //         else if(sub.indexOf('-') != -1){
    //             subcode = sub.substring(0,Math.min(sub.indexOf(' '),sub.indexOf('-')));
    //         }
    //         else{
    //             subcode = sub.substring(0,sub.indexOf(' '));
    //         }
    //         if (subcode!= ''){
    //             let sql= "SELECT 1 FROM `" + subcode + "` LIMIT 1;"
    //             cbCount++;
    //             con.query(sql,function(err,result){
    //                 if(err){
    //                     throw err;
    //                 }
    //                 cbCount--;
    //                 if(cbCount == 0){
    //                     console.log("Done");
    //                 }
    //             });
    //         }
            
    //     })
    // })
})


function createStudentTable(){ //Function To Store all Students Details.
    sql = "SELECT Code FROM Courses WHERE 1"
    con.query(sql,function(err,result){
        if (err) throw err;
        result.forEach(function(sub){
            sql = "INSERT INTO Students (Name,rollNo,Branch,Arrears,Count) SELECT Name,rollNo,Branch,isArrear,0 FROM `"+sub.Code+"` WHERE 1 ON DUPLICATE KEY UPDATE Count = Count + 1 , Arrears = Arrears + isArrear"
            cbCount++;
            con.query(sql,function(err,result){
                if(err) throw err;
                console.log("Inserted Student into Students Table ");
                cbCount--;
                if(cbCount == 0){
                    console.log("Done");
                    process.exit(0);
                }
            })
        })
    })
}

function init() { //Function to Read ALL CSV
    var Students = fs.readdirSync(cwd);

    Students.forEach(function (student) {
        var folder = cwd + '/' + student;
        if (fs.statSync(folder).isDirectory()) {
            var files = fs.readdirSync(folder);
            files.forEach(function (file) {
                createRead(folder + '/' + file);
            })
        }

    });

}

function findCommon(){ //Function to Find no of common students between Subjects
    var query = "SELECT Code FROM Courses;"
    con.query(query,function(err,result){
        if(err) throw err;
        result = JSON.stringify(result);
        result = JSON.parse(result);
        for(var i=0;i<result.length-1;i++){
            let sub1 = result[i].Code;
            for(var j=i+1;j<result.length;j++){
                let sub2 = result[j].Code;
                var sql = "SELECT Count(`"+sub1+"`.rollNo) as count1 FROM `"+sub1+"` INNER JOIN `"+sub2+"` ON `"+sub1+"`.rollNo = `"+sub2+"`.rollNo WHERE `"+sub1+"`.isArrear = 0 AND `"+sub2+"`.isArrear = 0"
                var sql2 = "SELECT Count(`"+sub1+"`.rollNo) as count2 FROM `"+sub1+"` INNER JOIN `"+sub2+"` ON `"+sub1+"`.rollNo = `"+sub2+"`.rollNo WHERE `"+sub1+"`.isArrear = 1 OR `"+sub2+"`.isArrear = 1"
                var sql3 = "SELECT T1.count1 , T2.count2 FROM ("+sql+") AS T1 INNER JOIN ("+sql2+") AS T2 ON 1;"
                con.query(sql3,function(err,result){
                    // result = JSON.stringify(result);
                    // result = JSON.parse(result);
                    if(err) throw err;
                    cbCount++;
                    var arrears = result[0].count2
                    var students = result[0].count1 
                    var sqll = "INSERT INTO Matrix (FromSUB,ToSUB,Count,Arrears) VALUES('"+sub1+"','"+sub2+"',"+students + ","+arrears+");"
                    console.log(sub1 + '-' + sub2 + '=' + students + "("+arrears+")");
                    con.query(sqll,function(err){
                        if(err) throw err;
                        cbCount--;
                        console.log('Successfully added into Matrix Table..')
                        if(cbCount == 0){
                            createStudentTable()
                        }
                    })
                });
            }
        }
    })
}

function createRead(csvFile) {
    fs.createReadStream(csvFile).pipe(csv())
        .on('data', function (data) {
            let subcode;
            if (data[4] != '') {
                /*  formatting for Inconsistent format Of In the Spreadsheet All Hardcoded no need to bother
                    eg: Some places subjects code terminate with -
                        Some places subjects code terminate with .
                        Some places /
                */
                if(data.length > 5){
                    data.shift();
                    
                }
                data[4] = data[4].trim();
                
                if(data[4].indexOf('.') != -1){   
                    subcode = data[4].substring(0,data[4].indexOf('.'));
                }
                else if(data[4].indexOf('/') != -1){
                    subcode = data[4].substring(0,Math.min(data[4].indexOf(' '),data[4].indexOf('/')));
                }
                else if(data[4].indexOf('-') != -1){
                    subcode = data[4].substring(0,Math.min(data[4].indexOf(' '),data[4].indexOf('-')));
                }
                else{
                    subcode = data[4].substring(0,data[4].indexOf(' '));
                }
                // Relevant Code
                // Add Courses to Course List
                var query2 = "INSERT INTO Courses (Name,Code,Students) VALUES('" +data[4]+"','" +subcode+"', 1) ON DUPLICATE KEY UPDATE Students = Students+1" 
                //CREATE Table with name of SubjectCode
                var query = "CREATE TABLE IF NOT EXISTS " + subcode + " (ID int NOT NULL AUTO_INCREMENT,Branch varchar(255),rollNo varchar(255),name varchar(255),course varchar(255),isArrear boolean,PRIMARY KEY(ID),UNIQUE(rollNo))";
                cbCount++;
                con.query(query2,function(err){
                    if(err){
                        throw err;
                    }
                    cbCount--;
                    console.log('Added Student to Course...'+subcode);
                    if(cbCount == 0){
                        console.log('Finished adding courses..')
                        findCommmon()
                    }
                });
                con.query(query, function (err) {
                    cbCount --;
                    if (err) {
                        console.log(data);
                        throw err;
                    }
                    console.log("Table for "+ data[4] + "Created....")
                    cbCount++;
                    insert(data,subcode)
                    
                });
                
                

            }
        })
        .on('end', function (end) {
            console.log('Finshed reading ' + csvFile + '.....')
            return;
        });

}

function insert(data,subcode){ //Insert Students data for Subject
    isArrear = false;
    indexToCheck = 0;
    sem = data[0].split(' ')[0];
    subject = data[0].split(' ')[1];
    if(subject != 'BCA'){
       year = data[2].charAt(data[2].length - 4);
    } 
    else{
        year = data[2].charAt(data[2].length - 7);
    }
    if((sem == 'S1' && year != '7') || (sem == 'S3' && year != '6' ) || (sem == 'S5' && year != '5') || (sem=='S7' && year != '4')){
        isArrear = true;
    }
    var query = "INSERT IGNORE INTO " + subcode + " (Branch,rollNo,name,course,isArrear) VALUES('"+data[0]+"','"+data[2]+"','"+data[3]+"','"+data[4]+"'," + isArrear + ")";
    con.query(query,function(err){
        if (err) throw err;

        console.log("Inserted Into " + subcode + " .....");
        cbCount--;
        if(cbCount == 0){
            console.log("Database population done.....");
            findCommon()
        }
    });
}


