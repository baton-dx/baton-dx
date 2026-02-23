class BatonDx < Formula
  desc "CLI package manager for Developer Experience & AI configuration"
  homepage "https://github.com/baton-dx/baton-dx"
  url "https://registry.npmjs.org/@baton-dx/cli/-/cli-0.7.1.tgz"
  sha256 "5535c2c8750383ffd21a1b1f214cd499307fc206825e5949194f91c3abe96b76"
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
