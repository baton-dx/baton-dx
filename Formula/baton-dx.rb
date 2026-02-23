class BatonDx < Formula
  desc "CLI package manager for Developer Experience & AI configuration"
  homepage "https://github.com/baton-dx/baton-dx"
  url "https://registry.npmjs.org/@baton-dx/cli/-/cli-0.6.0.tgz"
  sha256 "657f1f81ad4e7a275ae678801a95b86dad518becd3dc1393c504330eb4a3c5f9"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/baton --version")
  end
end
