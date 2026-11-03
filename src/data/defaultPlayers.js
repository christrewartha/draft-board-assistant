import { makePlayer } from '../core/players.js';

// Starter pool so the app works out of the box. Order = consensus rank.
// This is a rough snapshot, not live data: teams change and ranks drift, so
// import a fresh rankings CSV (Settings) before your real draft.
const RAW = `
Ja'Marr Chase,WR,CIN
Bijan Robinson,RB,ATL
Jahmyr Gibbs,RB,DET
Puka Nacua,WR,LAR
CeeDee Lamb,WR,DAL
Justin Jefferson,WR,MIN
Christian McCaffrey,RB,SF
Jaxon Smith-Njigba,WR,SEA
Amon-Ra St. Brown,WR,DET
De'Von Achane,RB,MIA
Saquon Barkley,RB,PHI
Jonathan Taylor,RB,IND
Malik Nabers,WR,NYG
Ashton Jeanty,RB,LV
Nico Collins,WR,HOU
Derrick Henry,RB,BAL
Josh Jacobs,RB,GB
Drake London,WR,ATL
James Cook,RB,BUF
Brian Thomas Jr.,WR,JAX
A.J. Brown,WR,PHI
Trey McBride,TE,ARI
Chase Brown,RB,CIN
Kyren Williams,RB,LAR
Garrett Wilson,WR,NYJ
Ladd McConkey,WR,LAC
Tee Higgins,WR,CIN
Omarion Hampton,RB,LAC
Brock Bowers,TE,LV
Josh Allen,QB,BUF
Lamar Jackson,QB,BAL
Bucky Irving,RB,TB
Tetairoa McMillan,WR,CAR
George Pickens,WR,DAL
Davante Adams,WR,LAR
Breece Hall,RB,NYJ
Jayden Daniels,QB,WAS
Jalen Hurts,QB,PHI
Zay Flowers,WR,BAL
Emeka Egbuka,WR,TB
Chris Olave,WR,NO
TreVeyon Henderson,RB,NE
Kenneth Walker III,RB,SEA
Joe Burrow,QB,CIN
Rashee Rice,WR,KC
DK Metcalf,WR,PIT
Terry McLaurin,WR,WAS
Jaylen Waddle,WR,MIA
Javonte Williams,RB,DAL
Quinshon Judkins,RB,CLE
Colston Loveland,TE,CHI
Tyler Warren,TE,IND
Sam LaPorta,TE,DET
Jameson Williams,WR,DET
Courtland Sutton,WR,DEN
DeVonta Smith,WR,PHI
Travis Etienne Jr.,RB,JAX
Alvin Kamara,RB,NO
D'Andre Swift,RB,CHI
Kyle Pitts,TE,ATL
Patrick Mahomes,QB,KC
Drake Maye,QB,NE
Michael Pittman Jr.,WR,IND
Xavier Worthy,WR,KC
Marvin Harrison Jr.,WR,ARI
Jordan Addison,WR,MIN
Rome Odunze,WR,CHI
Luther Burden III,WR,CHI
Chuba Hubbard,RB,CAR
RJ Harvey,RB,DEN
Kyler Murray,QB,ARI
Bo Nix,QB,DEN
Jaxson Dart,QB,NYG
Caleb Williams,QB,CHI
Justin Herbert,QB,LAC
Dak Prescott,QB,DAL
Baker Mayfield,QB,TB
Jared Goff,QB,DET
Brock Purdy,QB,SF
C.J. Stroud,QB,HOU
Trevor Lawrence,QB,JAX
Jordan Love,QB,GB
Dalton Kincaid,TE,BUF
Mark Andrews,TE,BAL
George Kittle,TE,SF
Jake Ferguson,TE,DAL
Travis Kelce,TE,KC
Dallas Goedert,TE,PHI
Hunter Henry,TE,NE
David Njoku,TE,CLE
Evan Engram,TE,DEN
Tucker Kraft,TE,GB
Harold Fannin Jr.,TE,CLE
Juwan Johnson,TE,NO
Aaron Jones,RB,MIN
Tony Pollard,RB,TEN
Rhamondre Stevenson,RB,NE
Zach Charbonnet,RB,SEA
Jaylen Warren,RB,PIT
Kaleb Johnson,RB,PIT
Rachaad White,RB,TB
Jacory Croskey-Merritt,RB,WAS
Woody Marks,RB,HOU
Tyrone Tracy Jr.,RB,NYG
Cam Skattebo,RB,NYG
Jordan Mason,RB,MIN
Isiah Pacheco,RB,KC
David Montgomery,RB,DET
Tank Bigsby,RB,PHI
Bhayshul Tuten,RB,JAX
Blake Corum,RB,LAR
Ray Davis,RB,BUF
Rico Dowdle,RB,CAR
Jaylen Wright,RB,MIA
Braelon Allen,RB,NYJ
Kenneth Gainwell,RB,PIT
Tyjae Spears,RB,TEN
Trey Benson,RB,ARI
James Conner,RB,ARI
Chris Godwin,WR,TB
Jakobi Meyers,WR,JAX
Jauan Jennings,WR,SF
Ricky Pearsall,WR,SF
Brandon Aiyuk,WR,SF
Stefon Diggs,WR,NE
Khalil Shakir,WR,BUF
Deebo Samuel,WR,WAS
Cooper Kupp,WR,SEA
Calvin Ridley,WR,TEN
Jerry Jeudy,WR,CLE
Matthew Golden,WR,GB
Jayden Reed,WR,GB
Christian Watson,WR,GB
Josh Downs,WR,IND
Alec Pierce,WR,IND
Wan'Dale Robinson,WR,NYG
Rashid Shaheed,WR,SEA
Troy Franklin,WR,DEN
Quentin Johnston,WR,LAC
Keenan Allen,WR,LAC
Tre Harris,WR,LAC
Cedric Tillman,WR,CLE
Romeo Doubs,WR,GB
Darnell Mooney,WR,ATL
Marvin Mims Jr.,WR,DEN
Jalen McMillan,WR,TB
Adonai Mitchell,WR,NYJ
Kayshon Boutte,WR,NE
Jalen Coker,WR,CAR
Tyler Shough,QB,NO
Matthew Stafford,QB,LAR
Sam Darnold,QB,SEA
Cam Ward,QB,TEN
Daniel Jones,QB,IND
Geno Smith,QB,LV
J.J. McCarthy,QB,MIN
Brenton Strange,TE,JAX
Chig Okonkwo,TE,TEN
Mason Taylor,TE,NYJ
Pat Freiermuth,TE,PIT
`;

export const DEFAULT_PLAYERS = RAW.trim()
  .split('\n')
  .map((line, i) => {
    const [name, pos, team] = line.split(',');
    return makePlayer({ name, pos, team, rank: i + 1 });
  });
