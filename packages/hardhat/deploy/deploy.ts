import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHEVoteDragonBall = await deploy("FHEVoteDragonBall", {
    from: deployer,
    log: true,
  });

  console.log(`FHEVoteDragonBall contract: `, deployedFHEVoteDragonBall.address);
};
export default func;
func.id = "deploy_FHEVoteDragonBall"; // id required to prevent reexecution
func.tags = ["FHEVoteDragonBall"];
